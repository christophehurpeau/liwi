import type { ServiceQuery } from "liwi-resources-client";
import type { DraftTask, Task } from "./Task.ts";

export type TaskSummary = Pick<Task, "_id" | "completed" | "created" | "label">;

export interface QueryAllParams {
  completed?: boolean;
  limit: number;
  page: number;
}

interface CreateParams {
  task: DraftTask;
}

interface PatchParams {
  id: Task["_id"];
  patch: Partial<Pick<Task, "completed" | "label">>;
}

export interface TasksService {
  queries: {
    queryAll: ServiceQuery<TaskSummary[], QueryAllParams>;
    queryWithoutParams: ServiceQuery<Task[], Record<string, never>>;
  };
  operations: {
    create: (params: CreateParams) => Promise<Task>;
    patch: (params: PatchParams) => Promise<Task>;
    clearCompleted: () => Promise<void>;
  };
}
