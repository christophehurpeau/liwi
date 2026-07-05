import type { TaskSummary, TasksService } from "@todo-example/modules";
import type { MouseEventHandler, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { OperationCallWrapper } from "react-liwi";

export interface TaskItemProps {
  task: TaskSummary;
  onChangeCompleted: (completed: boolean) => Promise<boolean>;
  onChangeLabel: (newText: string) => Promise<boolean>;
}

function TaskItem({
  task,
  onChangeCompleted,
  onChangeLabel,
}: TaskItemProps): ReactNode {
  const [optimisticUpdatedTask, setOptimisticUpdatedTask] = useState(task);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(task.label);
  const inputEditRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick: MouseEventHandler<HTMLLIElement> = (e): void => {
    e.preventDefault();
    e.stopPropagation();
    setEditing(true);
  };

  const handleSaveEditText = (): void => {
    onChangeLabel(editText).then(
      (success) => {
        if (!success) {
          setOptimisticUpdatedTask({
            ...optimisticUpdatedTask,
            label: task.label,
          });
        }
      },
      () => {
        setOptimisticUpdatedTask({
          ...optimisticUpdatedTask,
          label: task.label,
        });
      },
    );
    setOptimisticUpdatedTask({ ...optimisticUpdatedTask, label: editText });
    setEditing(false);
  };

  const handleCompletedChange = (): void => {
    onChangeCompleted(!optimisticUpdatedTask.completed).then(
      (success) => {
        if (!success) {
          setOptimisticUpdatedTask({
            ...optimisticUpdatedTask,
            completed: task.completed,
          });
        }
      },
      () => {
        setOptimisticUpdatedTask({
          ...optimisticUpdatedTask,
          completed: task.completed,
        });
      },
    );
    setOptimisticUpdatedTask({
      ...optimisticUpdatedTask,
      completed: !optimisticUpdatedTask.completed,
    });
    setEditing(false);
  };

  useEffect(() => {
    if (editing && inputEditRef.current) {
      inputEditRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    setOptimisticUpdatedTask(task);
    setEditText(task.label);
  }, [task]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li
      className={[
        optimisticUpdatedTask.completed && "completed",
        editing && "editing",
      ]
        .filter(Boolean)
        .join(" ")}
      onDoubleClick={handleDoubleClick}
    >
      <div className="view">
        <input
          checked={optimisticUpdatedTask.completed}
          className="toggle"
          type="checkbox"
          onChange={handleCompletedChange}
        />
        <label>{optimisticUpdatedTask.label}</label>
        <button type="button" className="destroy" />
      </div>
      <input
        ref={inputEditRef}
        className="edit"
        value={editText}
        onChange={(e) => {
          setEditText(e.target.value);
        }}
        onBlur={handleSaveEditText}
      />
    </li>
  );
}

export interface TodoListProps {
  tasks: TaskSummary[];
  patchTask: OperationCallWrapper<TasksService["operations"]["patch"]>;
}

export function TodoList({ tasks, patchTask }: TodoListProps): ReactNode {
  return (
    <ul className="todo-list">
      {/* List items should get the class `editing` when editing and `completed` when marked as completed */}
      {tasks.map((task) => (
        <TaskItem
          key={task._id}
          task={task}
          onChangeLabel={(newLabel): Promise<boolean> => {
            return patchTask({ id: task._id, patch: { label: newLabel } }).then(
              ([err]: any) => !err,
            );
          }}
          onChangeCompleted={(completed): Promise<boolean> => {
            return patchTask({ id: task._id, patch: { completed } }).then(
              ([err]: any) => !err,
            );
          }}
        />
      ))}
    </ul>
  );
}
