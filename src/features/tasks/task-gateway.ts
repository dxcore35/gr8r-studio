import type { Result, Task, TaskGatewayError, TaskId, TaskListData } from './types';

/**
 * Browser-facing task boundary.
 *
 * Implementations may call HTTP, MCP, or a deterministic in-memory source. It
 * deliberately does not model server application services or persistence.
 */
export interface TaskGateway {
  listMyTasks(): Promise<Result<TaskListData, TaskGatewayError>>;
  completeTask(taskId: TaskId): Promise<Result<Task, TaskGatewayError>>;
  reopenTask(taskId: TaskId): Promise<Result<Task, TaskGatewayError>>;
}
