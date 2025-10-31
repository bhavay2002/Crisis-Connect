import type { Response } from "express";
import { logger } from "./logger";

export interface ExportConfig {
  filename: string;
  headers: string[];
  batchSize?: number;
}

export class StreamExporter {
  private static CSV_SEPARATOR = ",";
  private static LINE_BREAK = "\n";

  static async exportToCSV<T extends Record<string, any>>(
    res: Response,
    fetchDataFn: (offset: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>,
    config: ExportConfig
  ): Promise<void> {
    const { filename, headers, batchSize = 1000 } = config;

    try {
      // Set headers for file download
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Transfer-Encoding", "chunked");

      // Write CSV headers
      const headerLine = headers.join(this.CSV_SEPARATOR) + this.LINE_BREAK;
      res.write(headerLine);

      let offset = 0;
      let hasMore = true;
      let totalRows = 0;

      while (hasMore) {
        const { data, hasMore: more } = await fetchDataFn(offset, batchSize);
        hasMore = more;

        // Convert data to CSV rows
        for (const item of data) {
          const row = headers
            .map((header) => {
              const value = item[header];
              return this.escapeCSVValue(value);
            })
            .join(this.CSV_SEPARATOR);

          res.write(row + this.LINE_BREAK);
          totalRows++;
        }

        offset += batchSize;

        // Allow event loop to process other requests
        await new Promise((resolve) => setImmediate(resolve));
      }

      res.end();

      logger.info("CSV export completed", {
        filename,
        totalRows,
      });
    } catch (error) {
      logger.error("CSV export failed", error as Error, { filename });
      if (!res.headersSent) {
        res.status(500).json({ message: "Export failed" });
      }
    }
  }

  static async exportToJSON<T>(
    res: Response,
    fetchDataFn: (offset: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>,
    filename: string,
    batchSize: number = 1000
  ): Promise<void> {
    try {
      // Set headers for file download
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Transfer-Encoding", "chunked");

      // Start JSON array
      res.write("[");

      let offset = 0;
      let hasMore = true;
      let isFirst = true;
      let totalRows = 0;

      while (hasMore) {
        const { data, hasMore: more } = await fetchDataFn(offset, batchSize);
        hasMore = more;

        for (const item of data) {
          if (!isFirst) {
            res.write(",");
          }
          res.write(JSON.stringify(item));
          isFirst = false;
          totalRows++;
        }

        offset += batchSize;

        // Allow event loop to process other requests
        await new Promise((resolve) => setImmediate(resolve));
      }

      // Close JSON array
      res.write("]");
      res.end();

      logger.info("JSON export completed", {
        filename,
        totalRows,
      });
    } catch (error) {
      logger.error("JSON export failed", error as Error, { filename });
      if (!res.headersSent) {
        res.status(500).json({ message: "Export failed" });
      }
    }
  }

  private static escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return "";
    }

    const stringValue = String(value);

    // Escape quotes and wrap in quotes if contains special characters
    if (
      stringValue.includes(this.CSV_SEPARATOR) ||
      stringValue.includes('"') ||
      stringValue.includes("\n") ||
      stringValue.includes("\r")
    ) {
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }

    return stringValue;
  }
}

export async function streamJSONLines<T>(
  res: Response,
  fetchDataFn: (offset: number, limit: number) => Promise<{ data: T[]; hasMore: boolean }>,
  batchSize: number = 1000
): Promise<void> {
  try {
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, hasMore: more } = await fetchDataFn(offset, batchSize);
      hasMore = more;

      for (const item of data) {
        res.write(JSON.stringify(item) + "\n");
      }

      offset += batchSize;
      await new Promise((resolve) => setImmediate(resolve));
    }

    res.end();
  } catch (error) {
    logger.error("NDJSON streaming failed", error as Error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Streaming failed" });
    }
  }
}
