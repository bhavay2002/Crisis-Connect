import { Router } from "express";
import { taskQueue, TaskStatus } from "../utils/taskQueue";
import { requireAuth } from "../middleware/commonChecks";
import { logger } from "../utils/logger";

export const tasksRouter = Router();

tasksRouter.get("/status/:taskId", requireAuth, (req, res) => {
  const { taskId } = req.params;
  const task = taskQueue.getTask(taskId);

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  res.json({
    id: task.id,
    name: task.name,
    status: task.status,
    progress: task.status === TaskStatus.COMPLETED ? 100 : 
             task.status === TaskStatus.IN_PROGRESS ? 50 : 0,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  });
});

tasksRouter.get("/all", requireAuth, (req, res) => {
  const tasks = taskQueue.getAllTasks();
  
  res.json({
    tasks: tasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    })),
  });
});

tasksRouter.get("/stats", requireAuth, (req, res) => {
  const allTasks = taskQueue.getAllTasks();
  
  const stats = {
    total: allTasks.length,
    pending: taskQueue.getTasksByStatus(TaskStatus.PENDING).length,
    inProgress: taskQueue.getTasksByStatus(TaskStatus.IN_PROGRESS).length,
    completed: taskQueue.getTasksByStatus(TaskStatus.COMPLETED).length,
    failed: taskQueue.getTasksByStatus(TaskStatus.FAILED).length,
  };

  logger.debug("Task queue stats requested", stats);

  res.json(stats);
});
