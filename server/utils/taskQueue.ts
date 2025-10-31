import { logger } from "./logger";

/**
 * WARNING: This is a basic in-memory task queue suitable for development and simple use cases.
 * 
 * Limitations:
 * - Tasks are stored in memory and will be lost on process restart
 * - Not suitable for critical tasks that must not be lost
 * - Does not support multiple workers or distributed processing
 * - No persistent storage or recovery mechanism
 * 
 * For production use with critical tasks, consider:
 * - Bull/BullMQ (Redis-backed queue)
 * - AWS SQS
 * - RabbitMQ
 * - Database-backed job queue (pg-boss, etc.)
 */

export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface Task<T = any> {
  id: string;
  name: string;
  status: TaskStatus;
  priority: number;
  data: T;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}

export type TaskHandler<T = any, R = any> = (data: T, task: Task<T>) => Promise<R>;

export class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private maxConcurrent: number;
  private currentlyProcessing: number = 0;
  private isShuttingDown: boolean = false;
  private pollInterval: number;

  constructor(maxConcurrent: number = 5, pollInterval: number = 1000) {
    this.maxConcurrent = maxConcurrent;
    this.pollInterval = pollInterval;
    
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      logger.info("Graceful shutdown initiated for task queue");
      await this.shutdown();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }

  registerHandler<T, R>(taskName: string, handler: TaskHandler<T, R>): void {
    this.handlers.set(taskName, handler as TaskHandler);
    logger.debug(`Task handler registered`, { taskName });
  }

  async addTask<T>(
    name: string,
    data: T,
    options: {
      priority?: number;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error("Cannot add tasks during shutdown");
    }

    const taskId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task: Task<T> = {
      id: taskId,
      name,
      status: TaskStatus.PENDING,
      priority: options.priority ?? 0,
      data,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
    };

    this.tasks.set(taskId, task);
    logger.info(`Task added to queue`, { taskId, taskName: name, priority: task.priority });

    if (!this.isProcessing) {
      this.startProcessing();
    }

    return taskId;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  private startProcessing(): void {
    if (this.processingInterval || this.isShuttingDown) {
      return;
    }

    this.isProcessing = true;
    logger.info(`Task queue processing started`);

    this.processingInterval = setInterval(() => {
      this.processNextTasks();
    }, this.pollInterval);
  }

  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    logger.info(`Task queue processing stopped`);
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info("Task queue shutdown in progress", {
      pendingTasks: this.getTasksByStatus(TaskStatus.PENDING).length,
      inProgressTasks: this.currentlyProcessing
    });

    this.stopProcessing();

    const maxWait = 30000;
    const startTime = Date.now();

    while (this.currentlyProcessing > 0 && Date.now() - startTime < maxWait) {
      logger.debug("Waiting for in-progress tasks to complete", {
        remaining: this.currentlyProcessing
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (this.currentlyProcessing > 0) {
      logger.warn("Shutdown timeout reached with tasks still processing", {
        abandoned: this.currentlyProcessing
      });
    } else {
      logger.info("All tasks completed before shutdown");
    }
  }

  isHealthy(): boolean {
    return !this.isShuttingDown && this.handlers.size > 0;
  }

  private async processNextTasks(): Promise<void> {
    if (this.currentlyProcessing >= this.maxConcurrent || this.isShuttingDown) {
      return;
    }

    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => task.status === TaskStatus.PENDING)
      .sort((a, b) => b.priority - a.priority);

    if (pendingTasks.length === 0 && this.currentlyProcessing === 0) {
      this.stopProcessing();
      return;
    }

    const tasksToProcess = pendingTasks.slice(0, this.maxConcurrent - this.currentlyProcessing);

    for (const task of tasksToProcess) {
      this.processTask(task);
    }
  }

  private async processTask(task: Task): Promise<void> {
    const handler = this.handlers.get(task.name);
    
    if (!handler) {
      task.status = TaskStatus.FAILED;
      task.error = `No handler registered for task: ${task.name}`;
      logger.error(`Task failed - no handler`, undefined, { taskId: task.id, taskName: task.name });
      return;
    }

    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();
    this.currentlyProcessing++;

    logger.info(`Task processing started`, { 
      taskId: task.id, 
      taskName: task.name,
      retryCount: task.retryCount 
    });

    try {
      const result = await handler(task.data, task);
      task.result = result;
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      
      logger.info(`Task completed successfully`, { 
        taskId: task.id, 
        taskName: task.name,
        duration: task.completedAt.getTime() - task.startedAt!.getTime()
      });
    } catch (error) {
      task.retryCount++;
      
      if (task.retryCount >= task.maxRetries) {
        task.status = TaskStatus.FAILED;
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();
        
        logger.error(`Task failed after retries`, error instanceof Error ? error : undefined, {
          taskId: task.id,
          taskName: task.name,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries
        });
      } else {
        task.status = TaskStatus.PENDING;
        logger.warn(`Task failed, will retry`, {
          taskId: task.id,
          taskName: task.name,
          retryCount: task.retryCount,
          maxRetries: task.maxRetries,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      this.currentlyProcessing--;
    }
  }

  clearCompletedTasks(olderThanMs: number = 3600000): void {
    const now = Date.now();
    let cleared = 0;

    for (const [taskId, task] of Array.from(this.tasks.entries())) {
      if (
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
        task.completedAt &&
        now - task.completedAt.getTime() > olderThanMs
      ) {
        this.tasks.delete(taskId);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info(`Cleared old tasks from queue`, { count: cleared });
    }
  }
}

export const taskQueue = new TaskQueue(5);

setInterval(() => {
  taskQueue.clearCompletedTasks();
}, 600000);
