import {
  BellRing,
  Ban,
  CalendarPlus,
  Check,
  CircleCheck,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Tag,
  Trash2,
  UserX,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {useEffect, useMemo, useRef, useState} from "react";
import {toDisplayDate} from "../../utils/formatters.jsx";

const QUARTER_HEIGHT = 28;

const toMinutes = (time) => {
  const [hours, minutes] = String(time ?? "08:00").split(":").map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes, startMinutes, endMinutes, slotMinutes) => {
  const normalized = Math.max(startMinutes, Math.min(endMinutes - slotMinutes, minutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
};

const shiftDate = (date, days) => {
  const nextDate = new Date(`${date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

const getWeekDates = (date) => {
  const selected = new Date(`${date}T12:00:00`);
  const mondayOffset = (selected.getDay() + 6) % 7;
  selected.setDate(selected.getDate() - mondayOffset);

  return Array.from({length: 7}, (_, index) => {
    const day = new Date(selected);
    day.setDate(selected.getDate() + index);
    return day.toISOString().slice(0, 10);
  });
};

const toClockTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const getEntryEndTime = (entry) =>
  toClockTime(toMinutes(entry.time) + Number(entry.duration || 0));

const isEntryEnded = (entry, selectedDate, now) => {
  if (entry.kind !== "visit") {
    return false;
  }

  if (["completed", "cancelled", "no_show"].includes(entry.status)) {
    return true;
  }

  const entryDate = new Date(`${entry.date || selectedDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (entryDate < today) {
    return true;
  }

  return entryDate.getTime() === today.getTime() &&
    toMinutes(entry.time) + Number(entry.duration || 0) <=
      now.getHours() * 60 + now.getMinutes();
};

const isEntryActive = (entry, selectedDate, now) =>
  entry.kind === "visit" && !isEntryEnded(entry, selectedDate, now);

const statusLabels = {
  scheduled: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Окончен",
  no_show: "No-show",
  cancelled: "Отменён",
};

const layoutOverlappingEntries = (entries) => {
  const sortedEntries = [...entries].sort(
    (first, second) => toMinutes(first.time) - toMinutes(second.time),
  );
  const groups = [];

  sortedEntries.forEach((entry) => {
    const start = toMinutes(entry.time);
    const end = start + Number(entry.duration || 0);
    const activeGroup = groups.find((group) => start < group.end);

    if (activeGroup) {
      activeGroup.entries.push({...entry, start, end});
      activeGroup.end = Math.max(activeGroup.end, end);
    } else {
      groups.push({end, entries: [{...entry, start, end}]});
    }
  });

  return groups.flatMap((group) => {
    const columnEnds = [];
    const positionedEntries = group.entries.map((entry) => {
      const availableColumn = columnEnds.findIndex((end) => end <= entry.start);
      const column = availableColumn === -1 ? columnEnds.length : availableColumn;
      columnEnds[column] = entry.end;
      return {...entry, overlapColumn: column};
    });
    const overlapCount = Math.max(columnEnds.length, 1);

    return positionedEntries.map((entry) => ({...entry, overlapCount}));
  });
};

function DroppableScheduleColumn({children, master, onClick}) {
  const {isOver, setNodeRef} = useDroppable({
    id: `schedule-master-${master}`,
    data: {master},
  });

  return (
    <div
      className={`schedule-column ${isOver ? "schedule-column-over" : ""}`}
      ref={setNodeRef}
      onClick={onClick}>
      {children}
    </div>
  );
}

function DraggableScheduleEntry({children, className, entry, style}) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
    id: `schedule-entry-${entry.id}`,
    data: {entry},
  });

  return (
    <article
      className={`${className} ${isDragging ? "schedule-entry-dragging" : ""}`}
      ref={setNodeRef}
      style={{
        ...style,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      onClick={(event) => event.stopPropagation()}
      {...listeners}
      {...attributes}>
      {children}
    </article>
  );
}

function CalendarPage({
  entries,
  visits,
  clients,
  clientPackages,
  employees,
  settings,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  onComplete,
  onRemind,
  onStatus,
  overlayOpen,
}) {
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [now, setNow] = useState(new Date());
  const [remindersVisible, setRemindersVisible] = useState(
    () => window.innerWidth > 700 && (settings.calendarRemindersVisible ?? true),
  );
  const [reminderFilter, setReminderFilter] = useState("active");
  const [openEntryMenuId, setOpenEntryMenuId] = useState(null);
  const [viewedClientEntry, setViewedClientEntry] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);
  const schedulePanelRef = useRef(null);
  const weekSwipeStart = useRef(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
  );
  const startMinutes = toMinutes(settings.workdayStart ?? "08:00");
  const configuredEndMinutes = toMinutes(settings.workdayEnd ?? "22:00");
  const endMinutes = configuredEndMinutes > startMinutes
    ? configuredEndMinutes
    : startMinutes + 60;
  const visualStartMinutes = startMinutes - (window.innerWidth <= 700 ? 120 : 0);
  const visualEndMinutes = endMinutes + (window.innerWidth <= 700 ? 120 : 0);
  const slotMinutes = Number(settings.calendarSlotMinutes) || 15;
  const minutesInDay = visualEndMinutes - visualStartMinutes;
  const slotHeight = QUARTER_HEIGHT;
  const gridHeight = (minutesInDay / slotMinutes) * slotHeight;
  const startHour = Math.floor(visualStartMinutes / 60);
  const endHour = Math.ceil(visualEndMinutes / 60);
  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.date === selectedDate)
        .filter((entry) => settings.calendarShowTasks || entry.kind !== "task"),
    [entries, selectedDate, settings.calendarShowTasks],
  );
  const visitEntries = dayEntries.filter((entry) => entry.kind === "visit");
  const activeVisitEntries = visitEntries.filter(
    (entry) => isEntryActive(entry, selectedDate, now),
  );
  const completedVisitEntries = visitEntries.filter(
    (entry) =>
      isEntryEnded(entry, selectedDate, now) &&
      !["cancelled", "no_show"].includes(entry.status),
  );
  const visibleReminderEntries = (
    reminderFilter === "active" ? activeVisitEntries : visitEntries
  ).sort((first, second) => String(first.time).localeCompare(String(second.time)));
  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const weekDates = getWeekDates(selectedDate);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTop =
    ((currentMinutes - visualStartMinutes) / minutesInDay) * gridHeight;
  const nextVisitId = activeVisitEntries
    .filter((entry) => !isToday || toMinutes(entry.time) >= currentMinutes)
    .sort((first, second) => String(first.time).localeCompare(String(second.time)))[0]?.id;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (employees.length <= 2 && schedulePanelRef.current) {
      schedulePanelRef.current.scrollLeft = 0;
    }
  }, [employees.length, selectedDate]);

  const getDragPosition = ({active, delta, over}) => {
    const entry = active.data.current?.entry;

    if (!entry) return null;

    const minuteDelta = Math.round((delta.y / slotHeight) * slotMinutes);
    const nextMinutes = toMinutes(entry.time) + minuteDelta;
    const time = toTime(nextMinutes, startMinutes, endMinutes, 1);

    return {
      entry,
      endTime: toClockTime(
        Math.min(endMinutes, toMinutes(time) + Number(entry.duration || 0)),
      ),
      master: over?.data.current?.master ?? entry.master,
      time,
    };
  };

  return (
    <section className="calendar-page">
      <div className="calendar-toolbar">
        <div>
          <h2>Календарь</h2>
          <p>{visitEntries.length} визитов запланировано</p>
        </div>
        <div className="calendar-toolbar-actions">
          <div className="calendar-date-control">
            <button
              aria-label="Предыдущий день"
              className="calendar-icon-button"
              type="button"
              onClick={() => setSelectedDate((current) => shiftDate(current, -1))}>
              <ChevronLeft size={17} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <button
              aria-label="Следующий день"
              className="calendar-icon-button"
              type="button"
              onClick={() => setSelectedDate((current) => shiftDate(current, 1))}>
              <ChevronRight size={17} />
            </button>
          </div>
          {!isToday && (
            <button
              className="secondary-button calendar-today-button"
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>
              Сегодня
            </button>
          )}
          {!remindersVisible && (
            <button
              aria-label="Открыть ленту дня"
              className="calendar-feed-toggle calendar-feed-toggle-open"
              title="Открыть ленту дня"
              type="button"
              onClick={() => setRemindersVisible(true)}>
              <ChevronLeft size={17} />
            </button>
          )}
          <button
            aria-label={remindersVisible ? "Скрыть ленту дня" : "Открыть ленту дня"}
            className={`mobile-calendar-feed-button ${overlayOpen ? "mobile-calendar-action-hidden" : ""}`}
            title="Лента дня"
            type="button"
            onClick={() => setRemindersVisible((current) => !current)}>
            {remindersVisible ? <X size={22} /> : <ClipboardList size={21} />}
          </button>
          <button
            className={`add-visit-button calendar-mobile-add-button ${overlayOpen || remindersVisible ? "mobile-calendar-action-hidden" : ""}`}
            type="button"
            onClick={() => onAdd({date: selectedDate})}>
            <Plus size={17} />
            Добавить
          </button>
        </div>
      </div>

      <div
        className="mobile-calendar-week"
        aria-label="Дни недели"
        onTouchStart={(event) => {
          weekSwipeStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = weekSwipeStart.current;
          const end = event.changedTouches[0]?.clientX;
          weekSwipeStart.current = null;
          if (start == null || end == null || Math.abs(end - start) < 42) return;
          setSelectedDate((current) => shiftDate(current, end < start ? 7 : -7));
        }}>
        {weekDates.map((date, index) => {
          const today = date === new Date().toISOString().slice(0, 10);
          return (
            <button
              className={`${date === selectedDate ? "selected" : ""} ${today ? "today" : ""}`}
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}>
              <span>{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"][index]}</span>
              <b>{Number(date.slice(-2))}</b>
            </button>
          );
        })}
      </div>

      <div className={`calendar-layout ${remindersVisible ? "" : "reminders-hidden"}`}>
        <DndContext
          sensors={sensors}
          onDragCancel={() => setDragPreview(null)}
          onDragMove={(event) => setDragPreview(getDragPosition(event))}
          onDragEnd={(event) => {
            const position = getDragPosition(event);
            setDragPreview(null);
            if (position) onMove(position.entry.id, {master: position.master, time: position.time});
          }}>
        <section
          className={`panel schedule-panel ${employees.length <= 2 ? "schedule-panel-fixed" : ""}`}
          ref={schedulePanelRef}>
          <div
            className="schedule-grid"
            style={{
              "--master-count": employees.length,
              "--mobile-master-width": `calc((100vw - 24px) / ${Math.min(Math.max(employees.length, 1), 2)})`,
              "--schedule-height": `${gridHeight}px`,
              "--schedule-hour-height": `${(60 / slotMinutes) * slotHeight}px`,
            }}>
            <div className="schedule-times">
              {Array.from({length: endHour - startHour}, (_, index) => (
                <div className="schedule-hour-label" key={index}>
                  <strong>{String(startHour + index).padStart(2, "0")}:00</strong>
                  {Array.from({length: 60 / slotMinutes - 1}, (_, slotIndex) => (
                    <span key={slotIndex}>{(slotIndex + 1) * slotMinutes}</span>
                  ))}
                </div>
              ))}
              <strong className="schedule-end-hour">{String(endHour).padStart(2, "0")}:00</strong>
            </div>
            {employees.map((employee) => (
              <div className="schedule-master" key={employee.id}>
                <header>
                  <strong>{employee.name}</strong>
                  <span>
                    {employee.role || "Мастер"} · {employee.shiftStart || settings.workdayStart || "08:00"}–
                    {employee.shiftEnd || settings.workdayEnd || "22:00"}
                  </span>
                </header>
                <DroppableScheduleColumn
                  master={employee.name}
                  onClick={(event) => {
                    if (event.target !== event.currentTarget) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    const rawMinutes =
                      visualStartMinutes +
                      ((event.clientY - rect.top) / gridHeight) * minutesInDay;
                    setPendingSlot({
                      date: selectedDate,
                      master: employee.name,
                      time: toTime(
                        Math.round(rawMinutes / slotMinutes) * slotMinutes,
                        startMinutes,
                        endMinutes,
                        slotMinutes,
                      ),
                    });
                  }}>
                  {(() => {
                    const shiftStart = Math.max(
                      visualStartMinutes,
                      toMinutes(employee.shiftStart || settings.workdayStart),
                    );
                    const shiftEnd = Math.min(
                      visualEndMinutes,
                      toMinutes(employee.shiftEnd || settings.workdayEnd),
                    );
                    const topHeight =
                      (Math.max(0, shiftStart - visualStartMinutes) / minutesInDay) * gridHeight;
                    const bottomTop =
                      (Math.max(0, shiftEnd - visualStartMinutes) / minutesInDay) * gridHeight;

                    return (
                      <>
                        {topHeight > 0 && (
                          <div className="schedule-off-hours" style={{height: topHeight, top: 0}} />
                        )}
                        {bottomTop < gridHeight && (
                          <div
                            className="schedule-off-hours"
                            style={{height: gridHeight - bottomTop, top: bottomTop}}
                          />
                        )}
                      </>
                    );
                  })()}
                  {settings.calendarNowLineVisible && isToday && currentTop >= 0 && currentTop <= gridHeight && (
                    <div className="calendar-now-line" style={{top: currentTop}}>
                      <i />
                      <span>{toTime(currentMinutes, startMinutes, endMinutes, slotMinutes)}</span>
                    </div>
                  )}
                  <div className="schedule-quarter-lines" aria-hidden="true">
                    {Array.from(
                      {length: minutesInDay / slotMinutes},
                      (_, index) => (
                        <i
                          className={index % (60 / slotMinutes) === 0 ? "hour" : ""}
                          key={index}
                          style={{top: index * slotHeight}}
                        />
                      ),
                    )}
                  </div>
                  {layoutOverlappingEntries(
                    dayEntries.filter((entry) => entry.master === employee.name),
                  )
                    .map((entry) => {
                      const displayedEntry =
                        dragPreview?.entry.id === entry.id
                          ? {...entry, time: dragPreview.time}
                          : entry;
                      const ended = isEntryEnded(entry, selectedDate, now);
                      const activeVisit = isEntryActive(entry, selectedDate, now);
                      const top =
                        ((toMinutes(entry.time) - visualStartMinutes) / minutesInDay) *
                        gridHeight;
                      const height = Math.max(
                        (Number(entry.duration) / minutesInDay) * gridHeight,
                        slotHeight,
                      );

                      return (
                        <DraggableScheduleEntry
                          className={`schedule-entry schedule-${entry.kind} schedule-status-${entry.status || "scheduled"} ${ended ? "schedule-entry-ended" : ""}`}
                          entry={entry}
                          key={entry.id}
                          style={{
                            "--entry-color": entry.color,
                            "--overlap-column": entry.overlapColumn,
                            "--overlap-count": entry.overlapCount,
                            height,
                            top,
                          }}>
                          <div>
                            <strong>{entry.kind === "visit" ? entry.client : entry.title}</strong>
                            <span>
                              {displayedEntry.time}–{getEntryEndTime(displayedEntry)}
                            </span>
                            {entry.kind === "visit" && <small>{entry.service}</small>}
                            {entry.kind === "visit" && entry.packageUsageId && (() => {
                              const packageItem = clientPackages.find(
                                (item) => item.id === entry.packageUsageId,
                              );
                              return packageItem ? (
                                <small className="schedule-entry-package">
                                  Пакет {packageItem.remainingVisits}/{packageItem.totalVisits}
                                </small>
                              ) : null;
                            })()}
                            {entry.kind === "visit" && (
                              <b>
                                {["no_show", "cancelled"].includes(entry.status)
                                  ? statusLabels[entry.status]
                                  : ended
                                    ? "Окончен"
                                    : statusLabels[entry.status] || statusLabels.scheduled}
                              </b>
                            )}
                          </div>
                          <div className="schedule-entry-actions">
                            <button
                              aria-label="Действия записи"
                              title="Действия"
                              type="button"
                              onClick={() =>
                                setOpenEntryMenuId((current) =>
                                  current === entry.id ? null : entry.id,
                                )
                              }>
                              <MoreVertical size={14} />
                            </button>
                            {openEntryMenuId === entry.id && (
                              <div className="schedule-entry-menu">
                                {entry.kind === "visit" && activeVisit && <button
                                  aria-label="Напомнить клиенту"
                                  title="Напомнить"
                                  type="button"
                                  onClick={() => onRemind(entry)}>
                                  <BellRing size={13} />
                                  Напомнить
                                </button>}
                                {activeVisit && entry.status !== "confirmed" && (
                                  <button
                                    aria-label="Подтвердить визит"
                                    title="Подтвердить"
                                    type="button"
                                    onClick={() => onStatus(entry, "confirmed")}>
                                    <CircleCheck size={13} />
                                    Подтвердить
                                  </button>
                                )}
                                {activeVisit && (
                                  <button
                                    aria-label="Клиент не пришёл"
                                    title="No-show"
                                    type="button"
                                    onClick={() => onStatus(entry, "no_show")}>
                                    <UserX size={13} />
                                    No-show
                                  </button>
                                )}
                                {activeVisit && (
                                  <button
                                    aria-label="Отменить визит"
                                    title="Отменить"
                                    type="button"
                                    onClick={() => onStatus(entry, "cancelled")}>
                                    <Ban size={13} />
                                    Отменить
                                  </button>
                                )}
                                {activeVisit && <button
                                  aria-label="Завершить визит"
                                  title="Завершить"
                                  type="button"
                                  onClick={() => onComplete(entry)}>
                                  <Check size={13} />
                                  Завершить
                                </button>}
                                <button
                              aria-label="Редактировать"
                              title="Редактировать"
                              type="button"
                              onClick={() => onEdit(entry)}>
                              <Pencil size={13} />
                              Редактировать
                            </button>
                            <button
                              aria-label="Удалить"
                              title="Удалить"
                              type="button"
                              onClick={() => onDelete(entry)}>
                              <Trash2 size={13} />
                              Удалить
                            </button>
                              </div>
                            )}
                          </div>
                        </DraggableScheduleEntry>
                      );
                    })}
                </DroppableScheduleColumn>
              </div>
            ))}
          </div>
        </section>
        {dragPreview && (
          <div className="calendar-drag-preview">
            <strong>{dragPreview.time}–{dragPreview.endTime}</strong>
            <span>{dragPreview.master}</span>
          </div>
        )}
        </DndContext>

        {remindersVisible && (
          <button
            aria-label="Закрыть ленту дня"
            className="mobile-calendar-reminders-backdrop"
            type="button"
            onClick={() => setRemindersVisible(false)}
          />
        )}
        {remindersVisible && <aside className="panel calendar-reminders">
          <div className="calendar-reminders-header">
            <div>
              <h2>Лента дня</h2>
              <p>{toDisplayDate(selectedDate)}</p>
            </div>
            <button
              aria-label="Скрыть ленту дня"
              className="calendar-feed-toggle"
              title="Скрыть ленту дня"
              type="button"
              onClick={() => setRemindersVisible(false)}>
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="calendar-reminders-summary">
            <span><b>{visitEntries.length}</b> всего</span>
            <span><b>{activeVisitEntries.length}</b> активных</span>
            <span><b>{completedVisitEntries.length}</b> окончено</span>
          </div>
          <div className="calendar-reminders-tabs">
            <button
              className={reminderFilter === "active" ? "active" : ""}
              type="button"
              onClick={() => setReminderFilter("active")}>
              Активные
            </button>
            <button
              className={reminderFilter === "all" ? "active" : ""}
              type="button"
              onClick={() => setReminderFilter("all")}>
              Все
            </button>
          </div>
          <div className="calendar-reminder-list">
            {visibleReminderEntries.map((entry) => {
              const activeVisit = isEntryActive(entry, selectedDate, now);

              return (
              <article className={entry.id === nextVisitId ? "calendar-reminder-next" : ""} key={entry.id}>
                <div className="calendar-reminder-time">
                  <strong>{entry.time}</strong>
                  <span>{getEntryEndTime(entry)}</span>
                </div>
                <div className="calendar-reminder-main">
                  <button
                    className="calendar-reminder-client"
                    type="button"
                    title="Открыть карточку клиента"
                    onClick={() => setViewedClientEntry(entry)}>
                    {entry.client}
                  </button>
                  <span>{entry.service}</span>
                  <small>
                    {entry.master} · {activeVisit
                      ? statusLabels[entry.status] || statusLabels.scheduled
                      : statusLabels[entry.status] || "Окончен"}
                  </small>
                </div>
                <div className="calendar-reminder-actions">
                  {activeVisit && <button
                    aria-label="Напомнить клиенту"
                    title="Напомнить клиенту"
                    type="button"
                    onClick={() => onRemind(entry)}>
                    <MessageSquareText size={14} />
                  </button>}
                  {activeVisit && entry.status !== "confirmed" && (
                    <button
                      aria-label="Подтвердить визит"
                      title="Подтвердить"
                      type="button"
                      onClick={() => onStatus(entry, "confirmed")}>
                      <CircleCheck size={14} />
                    </button>
                  )}
                  {activeVisit && (
                    <button
                      aria-label="Завершить визит"
                      title="Завершить"
                      type="button"
                      onClick={() => onComplete(entry)}>
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    aria-label="Редактировать визит"
                    title="Редактировать"
                    type="button"
                    onClick={() => onEdit(entry)}>
                    <Pencil size={14} />
                  </button>
                </div>
              </article>
              );
            })}
            {visibleReminderEntries.length === 0 && (
              <p>{visitEntries.length === 0 ? "На этот день визитов пока нет." : "Активных визитов больше нет."}</p>
            )}
          </div>
        </aside>}
      </div>
      {pendingSlot && (
        <div
          className="calendar-slot-backdrop"
          role="presentation"
          onClick={() => setPendingSlot(null)}>
          <section
            aria-label="Добавить запись"
            className="calendar-slot-menu"
            role="dialog"
            onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                onAdd({...pendingSlot, kind: "visit"});
                setPendingSlot(null);
              }}>
              <CalendarPlus size={18} />
              <span>
                <strong>Новый визит</strong>
                <small>Записать клиента</small>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onAdd({...pendingSlot, kind: "reserved"});
                setPendingSlot(null);
              }}>
              <Ban size={18} />
              <span>
                <strong>Зарезервировать время</strong>
                <small>Закрыть слот без клиента</small>
              </span>
            </button>
          </section>
        </div>
      )}
      {viewedClientEntry && (
        <ClientCalendarCard
          client={clients.find((client) => client.name === viewedClientEntry.client)}
          clientName={viewedClientEntry.client}
          clientPackages={clientPackages}
          currentEntry={viewedClientEntry}
          entries={entries}
          visits={visits}
          onAdd={() => {
            onAdd({date: selectedDate, client: viewedClientEntry.client});
            setViewedClientEntry(null);
          }}
          onClose={() => setViewedClientEntry(null)}
          onRemind={() => onRemind(viewedClientEntry)}
        />
      )}
    </section>
  );
}

function ClientCalendarCard({
  client,
  clientName,
  clientPackages,
  currentEntry,
  entries,
  visits,
  onAdd,
  onClose,
  onRemind,
}) {
  const relatedEntries = entries.filter(
    (entry) => entry.kind === "visit" && entry.client === clientName && entry.id !== currentEntry.id,
  );
  const futureVisits = relatedEntries.filter(
    (entry) => `${entry.date}T${entry.time}` > `${currentEntry.date}T${currentEntry.time}`,
  );
  const pastVisits = visits.filter((visit) => visit.client === clientName);
  const packages = clientPackages.filter(
    (packageItem) => packageItem.client === clientName && packageItem.status !== "Архив",
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="calendar-client-card" role="dialog" aria-labelledby="calendar-client-card-title">
        <header>
          <div>
            <span>{client?.status || "Активный"}</span>
            <h2 id="calendar-client-card-title">{clientName}</h2>
            <p>{currentEntry.time}–{getEntryEndTime(currentEntry)} · {currentEntry.service}</p>
          </div>
          <button aria-label="Закрыть карточку клиента" className="modal-close" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="calendar-client-card-actions">
          <button className="submit-button" type="button" onClick={onAdd}>
            <CalendarPlus size={15} />
            Новая запись
          </button>
          <button className="secondary-button" type="button" onClick={onRemind}>
            <MessageSquareText size={15} />
            Написать
          </button>
        </div>
        <div className="calendar-client-card-grid">
          <span><Phone size={14} /> Телефон <strong>{client?.phone || "—"}</strong></span>
          <span><Mail size={14} /> Email <strong>{client?.email || "—"}</strong></span>
          <span>Instagram <strong>{client?.instagram || "—"}</strong></span>
          <span>Telegram <strong>{client?.telegram || "—"}</strong></span>
          <span>Источник <strong>{client?.source || "—"}</strong></span>
          <span>Предпочтение <strong>{client?.preference || "—"}</strong></span>
          <span><Tag size={14} /> Теги <strong>{client?.tags || "—"}</strong></span>
          <span>Пакеты <strong>{packages.length}</strong></span>
        </div>
        <div className="calendar-client-summary-counts">
          <span><b>1</b> текущий визит</span>
          <span><b>{futureVisits.length}</b> будущих</span>
          <span><b>{pastVisits.length}</b> прошлых</span>
          <span><b>{packages.reduce((sum, item) => sum + Number(item.remainingVisits || 0), 0)}</b> сеансов в пакетах</span>
        </div>
        <div className="calendar-client-card-note">
          <strong>Комментарий</strong>
          <p>{client?.note || "Заметок пока нет."}</p>
        </div>
        {futureVisits.length > 0 && (
          <div className="calendar-client-card-visits">
            <strong>Будущие записи</strong>
            {futureVisits.slice(0, 3).map((visit) => (
              <small key={visit.id}>{toDisplayDate(visit.date)} · {visit.time} · {visit.service}</small>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default CalendarPage;
