import type { Task, TaskSummary, TasksService } from "@todo-example/modules";
import type { Update } from "liwi-mongo";
import type { ServiceResource } from "liwi-resources-server";
import { tasksStore } from "../stores/tasksStores.ts";

export const tasksService: ServiceResource<TasksService> = {
  queries: {
    queryAll: ({ completed, limit, page }) => {
      const securedLimit = Math.min(200, limit);
      return tasksStore.createQueryCollection({
        criteria: completed == null ? {} : { completed },
        sort: { created: 1 },
        fields: { completed: 1, created: 1, label: 1 },
        transformer: ({ _id, completed, created, label }): TaskSummary => ({
          _id,
          completed,
          created,
          label,
        }),
        limit: securedLimit,
        skip: (page - 1) * securedLimit,
      });
    },

    queryWithoutParams: async () => {
      // check async/await
      await new Promise((resolve) => {
        resolve(undefined);
      });

      return tasksStore.createQueryCollection({
        sort: { created: 1 },
        limit: 100,
      });
    },
  },
  operations: {
    create: ({ task }) => {
      return tasksStore.insertOne(task);
    },
    patch: async ({ id, patch }) => {
      const task = await tasksStore.findByKey(id);
      if (!task) throw new Error("Invalid task");

      const update: Update<Task>["$set"] = {};
      if (patch.completed != null) update.completed = patch.completed;
      if (patch.label != null) update.label = patch.label;

      return tasksStore.partialUpdateOne(task, { $set: update });
    },
    clearCompleted: () => {
      return tasksStore.deleteMany({ completed: true });
    },
  },
};
