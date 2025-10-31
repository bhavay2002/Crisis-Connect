import { logger } from "./logger";

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export type JobHandler<T = any> = (data: T) => Promise<void>;

export class JobQueue {
  private queue: Job[] = [];
  private handlers: Map<string, JobHandler> = new Map();
  private processing: Map<string, Job> = new Map();
  private isRunning = false;
  private concurrency = 3;
  private pollInterval = 1000;
  private pollTimer?: NodeJS.Timeout;

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  registerHandler<T = any>(jobType: string, handler: JobHandler<T>): void {
    this.handlers.set(jobType, handler as JobHandler);
    logger.info("Job handler registered", { jobType });
  }

  async enqueue<T = any>(
    type: string,
    data: T,
    options: { priority?: number; maxRetries?: number } = {}
  ): Promise<string> {
    const job: Job<T> = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      data,
      priority: options.priority ?? 0,
      retries: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: new Date(),
    };

    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);

    logger.info("Job enqueued", {
      jobId: job.id,
      jobType: type,
      priority: job.priority,
      queueSize: this.queue.length,
    });

    if (!this.isRunning) {
      this.start();
    }

    return job.id;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.info("Job queue started", { concurrency: this.concurrency });

    this.pollTimer = setInterval(() => {
      this.processJobs();
    }, this.pollInterval);

    this.processJobs();
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    logger.info("Job queue stopped", {
      pendingJobs: this.queue.length,
      processingJobs: this.processing.size,
    });
  }

  private async processJobs(): Promise<void> {
    while (this.processing.size < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      this.processJob(job);
    }
  }

  private async processJob(job: Job): Promise<void> {
    this.processing.set(job.id, job);
    job.startedAt = new Date();

    logger.info("Processing job", {
      jobId: job.id,
      jobType: job.type,
      attempt: job.retries + 1,
      maxRetries: job.maxRetries,
    });

    const handler = this.handlers.get(job.type);
    if (!handler) {
      logger.error("No handler registered for job type", undefined, {
        jobId: job.id,
        jobType: job.type,
      });
      this.processing.delete(job.id);
      return;
    }

    try {
      await handler(job.data);

      job.completedAt = new Date();
      const duration = job.completedAt.getTime() - job.startedAt!.getTime();

      logger.info("Job completed successfully", {
        jobId: job.id,
        jobType: job.type,
        duration: `${duration}ms`,
      });

      this.processing.delete(job.id);
    } catch (error) {
      job.retries++;
      job.error = (error as Error).message;

      logger.error("Job failed", error as Error, {
        jobId: job.id,
        jobType: job.type,
        attempt: job.retries,
        maxRetries: job.maxRetries,
      });

      if (job.retries < job.maxRetries) {
        logger.info("Retrying job", {
          jobId: job.id,
          jobType: job.type,
          attempt: job.retries + 1,
          maxRetries: job.maxRetries,
        });

        this.queue.unshift(job);
      } else {
        logger.error("Job failed permanently after max retries", undefined, {
          jobId: job.id,
          jobType: job.type,
          retries: job.retries,
          error: job.error,
        });
      }

      this.processing.delete(job.id);
    }
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      isRunning: this.isRunning,
      concurrency: this.concurrency,
      registeredHandlers: Array.from(this.handlers.keys()),
    };
  }

  async waitForJob(jobId: string, timeout = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isProcessing = this.processing.has(jobId);
      const isInQueue = this.queue.some(j => j.id === jobId);

      if (!isProcessing && !isInQueue) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }
}

export const jobQueue = new JobQueue(3);

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, stopping job queue");
  jobQueue.stop();
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, stopping job queue");
  jobQueue.stop();
});
