import {describe, expect, it} from "vitest";
import {
  applyOperationsFilters,
  buildMovedTask,
  expandTasksForRange,
  getDayStats,
  getTaskAssigneeId,
  getTaskDueDate,
  getTaskDueTime,
  getTaskEstimateMinutes,
  getTaskPayload,
  isTaskCompleted,
  isTaskMainOnDate,
  patchOccurrence,
} from "./operationsPlanner.js";

const repeatingTask = {
  completed: false,
  dueDate: "2026-10-12",
  id: 1,
  note: "Открыть смену",
  payload: {
    assigneeId: "7",
    checklist: [{done: false, id: "a", text: "Проверить кабинеты"}],
    dueDate: "2026-10-12",
    dueTime: "09:00",
    estimateMinutes: 30,
    priorityId: "high",
    repeat: {
      enabled: true,
      frequency: "weekdays",
      startDate: "2026-10-12",
      weekdays: [1, 3],
    },
    taskKind: "daily",
  },
  status: "active",
  title: "Подготовка студии",
  type: "task",
};

describe("operationsPlanner", () => {
  it("keeps new empty task forms from crashing on null task data", () => {
    expect(getTaskDueDate(null)).toBe("");
    expect(getTaskDueTime(null)).toBe("");
    expect(getTaskEstimateMinutes(null)).toBe(0);
    expect(getTaskAssigneeId(null)).toBe("");
    expect(isTaskCompleted(null)).toBe(false);
  });

  it("reads legacy nested task payloads", () => {
    const task = {
      payload: {
        dueDate: "2026-10-12",
        payload: {
          assigneeId: "3",
          priorityId: "low",
        },
      },
    };

    expect(getTaskPayload(task)).toMatchObject({
      assigneeId: "3",
      dueDate: "2026-10-12",
      priorityId: "low",
    });
    expect(getTaskPayload(task).payload).toBeUndefined();
  });

  it("expands recurring work only on selected weekdays", () => {
    const dates = expandTasksForRange([repeatingTask], "2026-10-12", "2026-10-18")
      .map(getTaskDueDate);

    expect(dates).toEqual(["2026-10-12", "2026-10-14"]);
  });

  it("moves a single recurring occurrence without moving the whole series", () => {
    const occurrence = expandTasksForRange([repeatingTask], "2026-10-14", "2026-10-14")[0];
    const movedTask = buildMovedTask(occurrence, "2026-10-16");
    const dates = expandTasksForRange([movedTask], "2026-10-14", "2026-10-16")
      .map(getTaskDueDate);

    expect(dates).toEqual(["2026-10-16"]);
  });

  it("patches one occurrence without completing the next one", () => {
    const occurrence = expandTasksForRange([repeatingTask], "2026-10-12", "2026-10-12")[0];
    const updatedTask = patchOccurrence(occurrence, "2026-10-12", {status: "completed"});
    const [first, second] = expandTasksForRange([updatedTask], "2026-10-12", "2026-10-14");

    expect(isTaskCompleted(first)).toBe(true);
    expect(isTaskCompleted(second)).toBe(false);
  });

  it("filters active assignee work and calculates day stats", () => {
    const tasks = [
      {
        ...repeatingTask,
        id: 2,
        payload: {...repeatingTask.payload, repeat: {enabled: false}},
      },
      {
        ...repeatingTask,
        completed: true,
        id: 3,
        payload: {...repeatingTask.payload, assigneeId: "8", repeat: {enabled: false}},
        status: "completed",
      },
    ];
    const filtered = applyOperationsFilters(tasks, {
      assigneeId: "7",
      priority: "high",
      query: "студии",
      showCompleted: false,
      status: "active",
      taskKind: "daily",
    });

    expect(filtered).toHaveLength(1);
    expect(getDayStats(filtered)).toMatchObject({
      completed: 0,
      planned: 1,
      remainingMinutes: 30,
    });
  });

  it("recognizes the main task for the selected day", () => {
    expect(
      isTaskMainOnDate(
        {
          payload: {
            dueDate: "2026-10-12",
            isMain: true,
            mainDate: "2026-10-14",
          },
        },
        "2026-10-14",
      ),
    ).toBe(true);
  });
});
