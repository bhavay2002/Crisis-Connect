# Background Task Queue

A simple in-memory task queue for running non-critical background operations.

## ⚠️ Important Limitations

This is a **basic in-memory task queue** suitable for:
- Development and testing
- Non-critical background tasks that can be lost on restart
- Simple async operations (email sending, notifications, etc.)

**NOT suitable for:**
- Critical tasks that must not be lost
- Production use with important data
- Distributed systems or multiple workers
- Tasks requiring persistence across restarts

**For production critical tasks**, use:
- Bull/BullMQ (Redis-backed)
- AWS SQS
- RabbitMQ
- Database-backed queues (pg-boss)

## Features

- **Async Task Processing**: Run tasks asynchronously without blocking requests
- **Priority Queue**: Tasks are processed based on priority (higher priority first)
- **Retry Logic**: Automatic retry with configurable max retries
- **Status Tracking**: Track task progress (pending, in_progress, completed, failed)
- **Concurrent Execution**: Process multiple tasks concurrently (default: 5)
- **Graceful Shutdown**: Waits for in-progress tasks before shutdown
- **Auto Cleanup**: Automatically removes old completed tasks
- **Idle Detection**: Stops polling when queue is empty

## Usage

### 1. Register a Task Handler

```typescript
import { taskQueue } from "../utils/taskQueue";

taskQueue.registerHandler("send-email", async (data: { to: string; subject: string; body: string }) => {
  await emailService.send(data);
  return { sent: true };
});

taskQueue.registerHandler("generate-report", async (data: { userId: string; reportType: string }) => {
  const report = await generateReport(data.userId, data.reportType);
  return { reportId: report.id, url: report.url };
});
```

### 2. Queue a Task

```typescript
import { taskQueue } from "../utils/taskQueue";

// In your route handler
const taskId = await taskQueue.addTask("send-email", {
  to: "user@example.com",
  subject: "Welcome",
  body: "Thanks for signing up!"
}, {
  priority: 10, // Higher priority = processed first
  maxRetries: 3  // Retry up to 3 times on failure
});

res.json({ taskId, message: "Email queued for sending" });
```

### 3. Check Task Status

```typescript
import { taskQueue } from "../utils/taskQueue";

const task = taskQueue.getTask(taskId);

if (task) {
  console.log(task.status); // "pending" | "in_progress" | "completed" | "failed"
  console.log(task.result); // Result from the handler if completed
  console.log(task.error);  // Error message if failed
}
```

### 4. API Endpoints

The task queue includes built-in API endpoints:

- `GET /api/tasks/status/:taskId` - Get status of a specific task
- `GET /api/tasks/all` - List all tasks
- `GET /api/tasks/stats` - Get queue statistics

## Example: Image Processing

```typescript
// Register handler
taskQueue.registerHandler("process-image", async (data: { imageUrl: string; filters: string[] }) => {
  const processed = await imageProcessor.apply(data.imageUrl, data.filters);
  return { processedUrl: processed.url };
});

// In your route
app.post("/api/images/process", async (req, res) => {
  const taskId = await taskQueue.addTask("process-image", {
    imageUrl: req.body.imageUrl,
    filters: req.body.filters
  }, { priority: 5 });
  
  res.json({ 
    taskId,
    statusUrl: `/api/tasks/status/${taskId}`
  });
});
```

## Lifecycle Management

The task queue includes graceful shutdown support:

```typescript
// Gracefully shut down the queue
await taskQueue.shutdown(); // Waits up to 30s for tasks to complete

// Check queue health
const healthy = taskQueue.isHealthy();
```

Shutdown happens automatically on SIGTERM/SIGINT signals.

## Best Practices

1. **Use for Non-Critical Tasks Only**: This is an in-memory queue
2. **Set Appropriate Priorities**: User-facing tasks = higher priority
3. **Handle Failures Gracefully**: Implement error handling in handlers
4. **Monitor Queue Stats**: Use `/api/tasks/stats` to monitor health
5. **Keep Tasks Idempotent**: Tasks may be retried on failure
6. **Don't Queue Critical Data**: Tasks are lost on restart

## Migration to Production Queue

When ready for production with persistent tasks:

```typescript
// Development (current)
import { taskQueue } from "../utils/taskQueue";

// Production (recommended)
import Queue from "bull"; // npm install bull
const taskQueue = new Queue("tasks", process.env.REDIS_URL);
```
