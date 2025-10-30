import type { DisasterReport } from "@shared/schema";

interface SimilarityScore {
  reportId: string;
  score: number;
  reasons: string[];
}

interface ClusterResult {
  clusterId: string;
  reports: DisasterReport[];
  primaryReport: DisasterReport;
  confidence: number;
  reasons: string[];
}

export class ReportClusteringService {
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly LOCATION_THRESHOLD_KM = 5;
  private readonly TIME_THRESHOLD_HOURS = 24;

  calculateTextSimilarity(text1: string, text2: string): number {
    const normalized1 = text1.toLowerCase().trim();
    const normalized2 = text2.toLowerCase().trim();

    if (normalized1 === normalized2) return 1.0;

    const words1 = new Set(normalized1.split(/\s+/));
    const words2 = new Set(normalized2.split(/\s+/));

    const words1Array = Array.from(words1);
    const words2Array = Array.from(words2);
    
    const intersection = new Set(words1Array.filter(x => words2.has(x)));
    const union = new Set([...words1Array, ...words2Array]);

    const jaccardSimilarity = intersection.size / union.size;

    const levenshteinSim = 1 - this.levenshteinDistance(normalized1, normalized2) / 
      Math.max(normalized1.length, normalized2.length);

    return (jaccardSimilarity * 0.6 + levenshteinSim * 0.4);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  calculateLocationDistance(
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

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  calculateTimeSimilarity(time1: Date, time2: Date): number {
    const diffHours = Math.abs(time1.getTime() - time2.getTime()) / (1000 * 60 * 60);
    if (diffHours === 0) return 1.0;
    if (diffHours > this.TIME_THRESHOLD_HOURS) return 0;
    return 1 - (diffHours / this.TIME_THRESHOLD_HOURS);
  }

  findSimilarReports(
    targetReport: DisasterReport,
    allReports: DisasterReport[]
  ): SimilarityScore[] {
    const similarities: SimilarityScore[] = [];

    for (const report of allReports) {
      if (report.id === targetReport.id) continue;

      const reasons: string[] = [];
      let totalScore = 0;
      let weightSum = 0;

      const titleSimilarity = this.calculateTextSimilarity(
        targetReport.title,
        report.title
      );
      if (titleSimilarity > 0.5) {
        totalScore += titleSimilarity * 2.5;
        weightSum += 2.5;
        reasons.push(`Title similarity: ${(titleSimilarity * 100).toFixed(0)}%`);
      }

      const descSimilarity = this.calculateTextSimilarity(
        targetReport.description,
        report.description
      );
      if (descSimilarity > 0.4) {
        totalScore += descSimilarity * 2.0;
        weightSum += 2.0;
        reasons.push(`Description similarity: ${(descSimilarity * 100).toFixed(0)}%`);
      }

      if (targetReport.type === report.type) {
        totalScore += 1.5;
        weightSum += 1.5;
        reasons.push(`Same disaster type: ${targetReport.type}`);
      }

      if (targetReport.severity === report.severity) {
        totalScore += 0.5;
        weightSum += 0.5;
        reasons.push(`Same severity: ${targetReport.severity}`);
      }

      if (
        targetReport.latitude &&
        targetReport.longitude &&
        report.latitude &&
        report.longitude
      ) {
        const distance = this.calculateLocationDistance(
          parseFloat(targetReport.latitude),
          parseFloat(targetReport.longitude),
          parseFloat(report.latitude),
          parseFloat(report.longitude)
        );

        if (distance <= this.LOCATION_THRESHOLD_KM) {
          const locationScore = 1 - distance / this.LOCATION_THRESHOLD_KM;
          totalScore += locationScore * 2.0;
          weightSum += 2.0;
          reasons.push(`Close proximity: ${distance.toFixed(2)} km away`);
        }
      }

      const timeSimilarity = this.calculateTimeSimilarity(
        new Date(targetReport.createdAt),
        new Date(report.createdAt)
      );
      if (timeSimilarity > 0.3) {
        totalScore += timeSimilarity * 1.0;
        weightSum += 1.0;
        const hoursDiff = Math.abs(
          new Date(targetReport.createdAt).getTime() -
            new Date(report.createdAt).getTime()
        ) / (1000 * 60 * 60);
        reasons.push(`Reported within ${hoursDiff.toFixed(1)} hours`);
      }

      if (weightSum > 0) {
        const finalScore = totalScore / weightSum;
        if (finalScore >= this.SIMILARITY_THRESHOLD && reasons.length >= 2) {
          similarities.push({
            reportId: report.id,
            score: finalScore,
            reasons,
          });
        }
      }
    }

    return similarities.sort((a, b) => b.score - a.score);
  }

  clusterReports(reports: DisasterReport[]): ClusterResult[] {
    const clusters: ClusterResult[] = [];
    const processed = new Set<string>();

    const sortedReports = [...reports].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    for (const primaryReport of sortedReports) {
      if (processed.has(primaryReport.id)) continue;

      const similar = this.findSimilarReports(primaryReport, sortedReports);
      
      if (similar.length > 0) {
        const clusterReports = [primaryReport];
        const allReasons = new Set<string>();
        let totalConfidence = 0;

        for (const sim of similar) {
          if (!processed.has(sim.reportId)) {
            const report = sortedReports.find(r => r.id === sim.reportId);
            if (report) {
              clusterReports.push(report);
              processed.add(sim.reportId);
              totalConfidence += sim.score;
              sim.reasons.forEach(r => allReasons.add(r));
            }
          }
        }

        processed.add(primaryReport.id);

        clusters.push({
          clusterId: primaryReport.id,
          reports: clusterReports,
          primaryReport,
          confidence: clusterReports.length > 1 
            ? totalConfidence / (clusterReports.length - 1) 
            : 1,
          reasons: Array.from(allReasons),
        });
      }
    }

    return clusters.sort((a, b) => b.reports.length - a.reports.length);
  }

  detectDuplicates(
    newReport: DisasterReport,
    existingReports: DisasterReport[]
  ): {
    isDuplicate: boolean;
    duplicateOf?: string;
    confidence: number;
    reasons: string[];
  } {
    const similar = this.findSimilarReports(newReport, existingReports);

    if (similar.length === 0) {
      return {
        isDuplicate: false,
        confidence: 0,
        reasons: [],
      };
    }

    const topMatch = similar[0];
    const isDuplicate = topMatch.score >= 0.85;

    return {
      isDuplicate,
      duplicateOf: isDuplicate ? topMatch.reportId : undefined,
      confidence: topMatch.score,
      reasons: topMatch.reasons,
    };
  }

  mergeClusters(cluster1: ClusterResult, cluster2: ClusterResult): ClusterResult {
    const earlierPrimary = new Date(cluster1.primaryReport.createdAt) < 
      new Date(cluster2.primaryReport.createdAt)
      ? cluster1.primaryReport
      : cluster2.primaryReport;

    const allReports = [...cluster1.reports, ...cluster2.reports];
    const uniqueReports = Array.from(
      new Map(allReports.map(r => [r.id, r])).values()
    );

    const allReasons = new Set([
      ...cluster1.reasons,
      ...cluster2.reasons,
    ]);

    return {
      clusterId: earlierPrimary.id,
      reports: uniqueReports,
      primaryReport: earlierPrimary,
      confidence: (cluster1.confidence + cluster2.confidence) / 2,
      reasons: Array.from(allReasons),
    };
  }
}

export const clusteringService = new ReportClusteringService();
