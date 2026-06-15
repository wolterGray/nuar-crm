export function getTaskSortRank(task) {
  if (task.status === "completed") return 10;
  if (task.priority === "Высокий") return 0;
  if (task.priority === "Средний") return 1;
  if (task.priority === "Низкий") return 2;
  return 3;
}

export function sortWorkTasks(workTasks) {
  return workTasks
    .map((task, index) => ({task, index}))
    .sort((left, right) => {
      const rankDiff = getTaskSortRank(left.task) - getTaskSortRank(right.task);
      if (rankDiff !== 0) return rankDiff;
      return left.index - right.index;
    })
    .map(({task}) => task);
}

export function reorderWorkTasksByDrop(workTasks, draggedTaskId, targetTaskId) {
  const sorted = sortWorkTasks(workTasks);
  const fromIdx = sorted.findIndex((task) => task.id === draggedTaskId);
  const toIdx = sorted.findIndex((task) => task.id === targetTaskId);

  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
    return workTasks;
  }

  const next = [...sorted];
  const [dragged] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, dragged);
  return next;
}
