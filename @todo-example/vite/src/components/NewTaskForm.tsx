import type { ReactNode, SubmitEventHandler } from "react";
import { use, useEffect, useState } from "react";
import { TransportClientReadyContext, useOperation } from "react-liwi";
import { TodoServicesContext } from "../app/services/TodoServicesProvider";

export function NewTaskForm(): ReactNode {
  const [newTaskInput, setNewTaskInput] = useState("");
  const todoServices = use(TodoServicesContext);
  const isReady = use(TransportClientReadyContext);
  const [createTask, { loading: taskCreating, error: taskCreateFailed }] =
    useOperation(todoServices.tasksService.operations.create);

  useEffect(() => {
    if (taskCreateFailed === undefined) return;
    // oxlint-disable-next-line no-alert
    alert(taskCreateFailed);
  }, [taskCreateFailed]);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!isReady) return;
    if (newTaskInput) {
      createTask({
        task: {
          label: newTaskInput,
          completed: false,
        },
      }).then(
        ([err]) => {
          if (!err) {
            setNewTaskInput("");
          }
        },
        (error: unknown) => {},
      );
    }
    return false;
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="new-todo"
        className="new-todo"
        placeholder="What needs to be done?"
        disabled={!isReady || taskCreating}
        value={newTaskInput}
        onChange={(e): void => {
          setNewTaskInput(e.target.value);
        }}
      />
    </form>
  );
}
