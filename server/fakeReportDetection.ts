import type { DisasterReport } from "@shared/schema";

const exifParser = require("exif-parser");

export interface ImageMetadata {
  hasExif: boolean;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  timestamp?: Date;
  cameraMake?: string;
  cameraModel?: string;
  software?: string;
  imageWidth?: number;
  imageHeight?: number;
  gpsMatchesLocation?: boolean;
  timestampRecent?: boolean;
}

export interface TextAnalysisResult {
  hasSpamPatterns: boolean;
  hasExcessiveCaps: boolean;
  hasRepeatedText: boolean;
  consistencyScore: number;
  similarityToOthers?: number;
  spamIndicators: string[];
}

export interface FakeDetectionResult {
  score: number;
  flags: string[];
  imageMetadata?: ImageMetadata[];
  textAnalysis: TextAnalysisResult;
  similarReportIds: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
}

export class FakeReportDetectionService {
  async analyzeReport(
    report: {
      title: string;
      description: string;
      location: string;
      latitude?: string;
      longitude?: string;
      type: string;
      severity: string;
    },
    mediaUrls: string[],
    existingReports: DisasterReport[],
    userId: string
  ): Promise<FakeDetectionResult> {
    const flags: string[] = [];
    let score = 0;

    const textAnalysis = await this.analyzeText(report, existingReports);
    const imageMetadata = await this.analyzeImages(mediaUrls, report);
    const similarReportIds = await this.findSimilarReports(report, existingReports);
    const userPatterns = await this.analyzeUserPatterns(userId, existingReports);

    if (textAnalysis.hasSpamPatterns) {
      score += 30;
      flags.push("spam_patterns_detected");
    }

    if (textAnalysis.hasExcessiveCaps) {
      score += 15;
      flags.push("excessive_capitalization");
    }

    if (textAnalysis.hasRepeatedText) {
      score += 20;
      flags.push("repeated_text_patterns");
    }

    if (textAnalysis.consistencyScore < 50) {
      score += 25;
      flags.push("low_consistency_score");
    }

    imageMetadata.forEach((meta, index) => {
      if (!meta.hasExif) {
        score += 10;
        flags.push(`image_${index + 1}_missing_metadata`);
      }

      if (meta.gpsMatchesLocation === false) {
        score += 40;
        flags.push(`image_${index + 1}_gps_location_mismatch`);
      }

      if (meta.timestampRecent === false) {
        score += 35;
        flags.push(`image_${index + 1}_old_timestamp`);
      }

      if (meta.software && this.isEditingSoftware(meta.software)) {
        score += 20;
        flags.push(`image_${index + 1}_edited_with_${meta.software}`);
      }
    });

    if (similarReportIds.length > 0) {
      score += 30;
      flags.push(`similar_to_${similarReportIds.length}_reports`);
    }

    if (userPatterns.isNewUser && report.severity === "critical") {
      score += 25;
      flags.push("new_user_critical_report");
    }

    if (userPatterns.multipleReportsInShortTime) {
      score += 20;
      flags.push("multiple_reports_short_timeframe");
    }

    score = Math.min(100, score);

    const riskLevel = this.calculateRiskLevel(score);

    return {
      score,
      flags,
      imageMetadata,
      textAnalysis,
      similarReportIds,
      riskLevel,
    };
  }

  private async analyzeText(
    report: {
      title: string;
      description: string;
      location: string;
      type: string;
      severity: string;
    },
    existingReports: DisasterReport[]
  ): Promise<TextAnalysisResult> {
    const spamIndicators: string[] = [];
    const combinedText = `${report.title} ${report.description}`.toLowerCase();

    const spamPatterns = [
      /click here/gi,
      /free money/gi,
      /urgent!!!!/gi,
      /act now/gi,
      /limited time/gi,
      /congratulations/gi,
      /winner/gi,
      /claim.*prize/gi,
    ];

    const hasSpamPatterns = spamPatterns.some((pattern) => {
      const match = pattern.test(combinedText);
      if (match) {
        spamIndicators.push(`spam_pattern: ${pattern.source}`);
      }
      return match;
    });

    const capsCount = (report.title + report.description).replace(/[^A-Z]/g, "").length;
    const totalLetters = (report.title + report.description).replace(/[^A-Za-z]/g, "").length;
    const capsRatio = totalLetters > 0 ? capsCount / totalLetters : 0;
    const hasExcessiveCaps = capsRatio > 0.5 && totalLetters > 20;

    const words = combinedText.split(/\s+/);
    const wordCount: Record<string, number> = {};
    words.forEach((word) => {
      if (word.length > 3) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    const maxRepetition = Math.max(...Object.values(wordCount), 0);
    const hasRepeatedText = maxRepetition > words.length * 0.2 && words.length > 10;

    let consistencyScore = 100;
    
    const typeKeywords: Record<string, string[]> = {
      fire: ["fire", "flame", "smoke", "burn", "blaze"],
      flood: ["flood", "water", "rain", "overflow", "inundation"],
      earthquake: ["earthquake", "tremor", "shake", "seismic"],
      storm: ["storm", "wind", "hurricane", "cyclone", "tornado"],
      road_accident: ["accident", "crash", "collision", "vehicle"],
      epidemic: ["disease", "illness", "outbreak", "infection"],
      landslide: ["landslide", "soil", "slope", "erosion"],
      gas_leak: ["gas", "leak", "smell", "fumes"],
    };

    const expectedKeywords = typeKeywords[report.type] || [];
    const hasRelevantKeywords = expectedKeywords.some((keyword) =>
      combinedText.includes(keyword)
    );

    if (!hasRelevantKeywords && expectedKeywords.length > 0) {
      consistencyScore -= 40;
      spamIndicators.push("missing_disaster_type_keywords");
    }

    if (report.description.length < 20) {
      consistencyScore -= 20;
      spamIndicators.push("description_too_short");
    }

    if (report.title.length < 5) {
      consistencyScore -= 15;
      spamIndicators.push("title_too_short");
    }

    return {
      hasSpamPatterns,
      hasExcessiveCaps,
      hasRepeatedText,
      consistencyScore: Math.max(0, consistencyScore),
      spamIndicators,
    };
  }

  private async analyzeImages(
    mediaUrls: string[],
    report: { latitude?: string; longitude?: string }
  ): Promise<ImageMetadata[]> {
    const results: ImageMetadata[] = [];

    for (const url of mediaUrls) {
      try {
        const metadata = await this.extractImageMetadata(url, report);
        results.push(metadata);
      } catch (error) {
        console.error(`Failed to analyze image ${url}:`, error);
        results.push({
          hasExif: false,
        });
      }
    }

    return results;
  }

  private async extractImageMetadata(
    imageUrl: string,
    report: { latitude?: string; longitude?: string }
  ): Promise<ImageMetadata> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return { hasExif: false };
      }

      const buffer = await response.arrayBuffer();
      const parser = exifParser.create(Buffer.from(buffer));
      const result = parser.parse();

      const metadata: ImageMetadata = {
        hasExif: result.tags && Object.keys(result.tags).length > 0,
        imageWidth: result.imageSize?.width,
        imageHeight: result.imageSize?.height,
      };

      if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
        metadata.gpsCoordinates = {
          latitude: result.tags.GPSLatitude,
          longitude: result.tags.GPSLongitude,
        };

        if (report.latitude && report.longitude) {
          const distance = this.calculateDistance(
            parseFloat(report.latitude),
            parseFloat(report.longitude),
            result.tags.GPSLatitude,
            result.tags.GPSLongitude
          );
          metadata.gpsMatchesLocation = distance < 10;
        }
      }

      if (result.tags.DateTimeOriginal) {
        const imageDate = new Date(result.tags.DateTimeOriginal * 1000);
        metadata.timestamp = imageDate;
        const daysSincePhoto = (Date.now() - imageDate.getTime()) / (1000 * 60 * 60 * 24);
        metadata.timestampRecent = daysSincePhoto < 7;
      }

      if (result.tags.Make) {
        metadata.cameraMake = result.tags.Make;
      }

      if (result.tags.Model) {
        metadata.cameraModel = result.tags.Model;
      }

      if (result.tags.Software) {
        metadata.software = result.tags.Software;
      }

      return metadata;
    } catch (error) {
      console.error("EXIF parsing error:", error);
      return { hasExif: false };
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private isEditingSoftware(software: string): boolean {
    const editingSoftware = [
      "photoshop",
      "gimp",
      "lightroom",
      "pixlr",
      "canva",
      "illustrator",
      "affinity",
    ];
    return editingSoftware.some((editor) =>
      software.toLowerCase().includes(editor)
    );
  }

  private async findSimilarReports(
    report: {
      title: string;
      description: string;
      location: string;
      type: string;
    },
    existingReports: DisasterReport[]
  ): Promise<string[]> {
    const similarReports: string[] = [];
    const reportText = `${report.title} ${report.description}`.toLowerCase();
    const reportWords = new Set(reportText.split(/\s+/).filter((w) => w.length > 3));

    for (const existing of existingReports) {
      const existingText = `${existing.title} ${existing.description}`.toLowerCase();
      const existingWords = new Set(existingText.split(/\s+/).filter((w) => w.length > 3));

      const reportWordsArray = Array.from(reportWords);
      const existingWordsArray = Array.from(existingWords);
      
      const intersection = reportWordsArray.filter((word) => existingWords.has(word));
      const union = new Set([...reportWordsArray, ...existingWordsArray]);
      const similarity = intersection.length / union.size;

      if (
        similarity > 0.7 &&
        existing.type === report.type &&
        existing.location === report.location
      ) {
        similarReports.push(existing.id);
      }
    }

    return similarReports;
  }

  private async analyzeUserPatterns(
    userId: string,
    existingReports: DisasterReport[]
  ): Promise<{
    isNewUser: boolean;
    multipleReportsInShortTime: boolean;
  }> {
    const userReports = existingReports.filter((r) => r.userId === userId);
    const isNewUser = userReports.length === 0;

    const recentReports = userReports.filter((r) => {
      const hoursSinceReport =
        (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
      return hoursSinceReport < 1;
    });

    const multipleReportsInShortTime = recentReports.length > 2;

    return {
      isNewUser,
      multipleReportsInShortTime,
    };
  }

  private calculateRiskLevel(
    score: number
  ): "low" | "medium" | "high" | "critical" {
    if (score >= 75) return "critical";
    if (score >= 50) return "high";
    if (score >= 25) return "medium";
    return "low";
  }
}
