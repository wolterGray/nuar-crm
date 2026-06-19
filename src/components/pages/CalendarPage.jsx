import {
  Ban,
  BellRing,
  CalendarPlus,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Mail,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Rocket,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {getTodayInput} from "../../utils/dateHelpers.js";
import {normalizeCalendarEntryDate} from "../../utils/dateUtils.js";
import PageHeader from "../PageHeader.jsx";
import CalendarDayList from "../CalendarDayList.jsx";
import MobileSheet from "../MobileSheet.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {isMobileViewport} from "../../constants/breakpoints.js";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {formatMoney, toDisplayDate} from "../../utils/formatters.jsx";
import {matchesClientRecord} from "../../utils/clientLinks.js";
import {isActiveClientPackage} from "../../utils/clientPackages.js";
import {getPackageProgressLabel, isUpcomingPackageVisit} from "../../utils/packages.jsx";
import {getVisitDebt, getVisitTransactionTotal} from "../../utils/visits.jsx";

const QUARTER_HEIGHT = 22;
const isValidInputDate = (date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(date)) &&
  !Number.isNaN(new Date(`${date}T12:00:00`).getTime());

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
  if (!isValidInputDate(date)) return getTodayInput();

  const nextDate = new Date(`${date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
};

const toClockTime = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

const getEntryEndTime = (entry) =>
  toClockTime(toMinutes(entry.time) + Number(entry.duration || 0));

const getEntryMoneyLabel = (entry) => {
  const debt = getVisitDebt(entry);

  if (debt > 0) {
    return `Долг ${formatMoney(debt)}`;
  }

  return formatMoney(getVisitTransactionTotal(entry));
};

const isEntryEnded = (entry, selectedDate, now) => {
  if (entry.kind !== "visit") {
    return false;
  }

  if (["completed", "cancelled", "no_show"].includes(entry.status)) {
    return true;
  }

  const entryDateValue = normalizeCalendarEntryDate(entry.date || selectedDate);
  const entryDate = new Date(`${entryDateValue}T12:00:00`);
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
  no_show: "Не пришёл",
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

function DroppableScheduleColumn({
  children,
  master,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const {isOver, setNodeRef} = useDroppable({
    id: `schedule-master-${master}`,
    data: {master},
  });

  return (
    <div
      className={`schedule-column ${isOver ? "schedule-column-over" : ""}`}
      ref={setNodeRef}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}>
      {children}
    </div>
  );
}

function DraggableScheduleEntry({children, className, domId, entry, style}) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({
    id: `schedule-entry-${entry.id}`,
    data: {entry},
  });

  return (
    <article
      className={`${className} ${isDragging ? "schedule-entry-dragging" : ""}`}
      id={domId}
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
  alertFocus,
  entries,
  visits,
  clients,
  clientPackages,
  employees,
  settings,
  onAdd,
  onAlertFocusHandled,
  onEdit,
  onDelete,
  onMove,
  onRemind,
  onStatus,
  overlayOpen,
}) {
  const {isMobile} = useBreakpoint();
  const [selectedDate, setSelectedDate] = useState(
    () => getTodayInput(),
  );
  const [now, setNow] = useState(new Date());
  const [mobileCalendarView, setMobileCalendarView] = useState("grid");
  const [remindersVisible, setRemindersVisible] = useState(
    () => !isMobileViewport() && (settings.calendarRemindersVisible ?? true),
  );
  const [reminderFilter, setReminderFilter] = useState("active");
  const [openEntryMenuId, setOpenEntryMenuId] = useState(null);
  const [viewedClientEntry, setViewedClientEntry] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);
  const dateInputRef = useRef(null);
  const schedulePanelRef = useRef(null);
  const weekCarouselRef = useRef(null);
  const longPressRef = useRef(null);
  const previousSelectedDateRef = useRef(null);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {distance: 5},
    }),
    useSensor(TouchSensor, {
      activationConstraint: {delay: 320, tolerance: 8},
    }),
  );
  const isFocusedEntry = (entryId) =>
    alertFocus?.type === "calendar" &&
    String(alertFocus.entityId) === String(entryId);

  useEffect(() => {
    if (!alertFocus?.entityId || alertFocus.type !== "calendar") {
      return undefined;
    }

    const entry = entries.find(
      (item) => String(item.id) === String(alertFocus.entityId),
    );

    const setupTimer = window.setTimeout(() => {
      if (entry?.date) {
        setSelectedDate(normalizeCalendarEntryDate(entry.date));
      }

      window.setTimeout(() => {
        document
          .getElementById(`alert-focus-calendar-${alertFocus.entityId}`)
          ?.scrollIntoView({behavior: "smooth", block: "center"});
      }, 120);
    }, 0);
    const clearTimer = window.setTimeout(() => {
      onAlertFocusHandled?.();
    }, 4500);

    return () => {
      window.clearTimeout(setupTimer);
      window.clearTimeout(clearTimer);
    };
  }, [alertFocus, entries, onAlertFocusHandled]);

  const startMinutes = toMinutes(settings.workdayStart ?? "08:00");
  const configuredEndMinutes = toMinutes(settings.workdayEnd ?? "22:00");
  const endMinutes = configuredEndMinutes > startMinutes
    ? configuredEndMinutes
    : startMinutes + 60;
  const visualStartMinutes = startMinutes - 120;
  const visualEndMinutes = endMinutes + 120;
  const slotMinutes = Number(settings.calendarSlotMinutes) || 15;
  const minutesInDay = visualEndMinutes - visualStartMinutes;
  const slotHeight = QUARTER_HEIGHT;
  const gridHeight = (minutesInDay / slotMinutes) * slotHeight;
  const startHour = Math.floor(visualStartMinutes / 60);
  const endHour = Math.ceil(visualEndMinutes / 60);
  const dayEntries = useMemo(
    () =>
      entries
        .filter(
          (entry) => normalizeCalendarEntryDate(entry.date) === selectedDate,
        )
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
  const isToday = selectedDate === getTodayInput();
  const carouselDates = useMemo(
    () =>
      Array.from({length: 1461}, (_, index) =>
        shiftDate(getTodayInput(), index - 730),
      ),
    [],
  );
  const selectCalendarDate = (nextDate) => {
    setSelectedDate(nextDate);
  };
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

  const showDayList = isMobile && mobileCalendarView === "list";
  const showScheduleGrid = !isMobile || mobileCalendarView === "grid";
  const showRemindersPanel = showScheduleGrid && !isMobile && remindersVisible;

  useEffect(
    () => () => {
      if (longPressRef.current?.timer) {
        window.clearTimeout(longPressRef.current.timer);
      }
    },
    [],
  );

  useEffect(() => {
    if (employees.length <= 2 && schedulePanelRef.current) {
      schedulePanelRef.current.scrollLeft = 0;
    }
  }, [employees.length, selectedDate]);

  useLayoutEffect(() => {
    if (!weekCarouselRef.current) return;

    if (previousSelectedDateRef.current === selectedDate) return;

    previousSelectedDateRef.current = selectedDate;

    const container = weekCarouselRef.current;
    const selectedButton = container.querySelector(
      `[data-date="${selectedDate}"]`,
    );
    if (!selectedButton) return;

    container.scrollLeft = Math.max(0, selectedButton.offsetLeft - 10);
  }, [carouselDates, selectedDate]);

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

  const clearSlotLongPress = () => {
    if (longPressRef.current?.timer) {
      window.clearTimeout(longPressRef.current.timer);
    }
    longPressRef.current = null;
  };

  const getSlotFromPointer = (event, employeeName) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawMinutes =
      visualStartMinutes +
      ((event.clientY - rect.top) / gridHeight) * minutesInDay;

    return {
      date: selectedDate,
      master: employeeName,
      time: toTime(
        Math.round(rawMinutes / slotMinutes) * slotMinutes,
        startMinutes,
        endMinutes,
        slotMinutes,
      ),
    };
  };

  const startSlotLongPress = (event, employeeName) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest(".schedule-entry")) return;

    const slot = getSlotFromPointer(event, employeeName);
    clearSlotLongPress();
    longPressRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      timer: window.setTimeout(() => {
        setPendingSlot(slot);
        longPressRef.current = null;
      }, 520),
    };
  };

  const moveSlotLongPress = (event) => {
    if (!longPressRef.current) return;

    const distance = Math.hypot(
      event.clientX - longPressRef.current.startX,
      event.clientY - longPressRef.current.startY,
    );

    if (distance > 10) {
      clearSlotLongPress();
    }
  };

  return (
    <section className="calendar-page">
      <PageHeader
        actions={
          <div className="calendar-toolbar-actions">
            <div className="calendar-date-control">
              <button
                aria-label="Предыдущий день"
                className="calendar-date-arrow"
                type="button"
                onClick={() => selectCalendarDate(shiftDate(selectedDate, -1))}>
                <ChevronLeft size={17} />
              </button>
              <label
                className="calendar-date-field"
                onClick={(event) => {
                  if (event.target === dateInputRef.current) return;
                  dateInputRef.current?.showPicker?.();
                  dateInputRef.current?.focus();
                }}>
                <span>{toDisplayDate(selectedDate)}</span>
                <input
                  aria-label="Выбрать дату"
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    if (isValidInputDate(event.target.value)) {
                      selectCalendarDate(event.target.value);
                    }
                  }}
                />
              </label>
              <button
                aria-label="Следующий день"
                className="calendar-date-arrow"
                type="button"
                onClick={() => selectCalendarDate(shiftDate(selectedDate, 1))}>
                <ChevronRight size={17} />
              </button>
            </div>
            {!isToday && !isMobile && (
              <button
                className="secondary-button calendar-today-button"
                type="button"
                onClick={() => selectCalendarDate(getTodayInput())}>
                Сегодня
              </button>
            )}
            {!remindersVisible && !showDayList && (
              <button
                aria-label="Открыть ленту дня"
                className="calendar-feed-toggle calendar-feed-toggle-open"
                title="Открыть ленту дня"
                type="button"
                onClick={() => setRemindersVisible(true)}>
                <ChevronLeft size={17} />
              </button>
            )}
            {isMobile && (
              <button
                aria-label={showDayList ? "Показать сетку" : "Показать список"}
                className={`calendar-view-toggle ${overlayOpen ? "mobile-calendar-action-hidden" : ""}`}
                title={showDayList ? "Сетка" : "Список"}
                type="button"
                onClick={() =>
                  setMobileCalendarView((current) => (current === "list" ? "grid" : "list"))
                }>
                {showDayList ? <LayoutGrid size={20} /> : <List size={20} />}
              </button>
            )}
            {!isMobile && (
              <button
                aria-label={remindersVisible ? "Скрыть ленту дня" : "Открыть ленту дня"}
                className={`mobile-calendar-feed-button ${overlayOpen ? "mobile-calendar-action-hidden" : ""}`}
                title="Лента дня"
                type="button"
                onClick={() => setRemindersVisible((current) => !current)}>
                {remindersVisible ? <X size={22} /> : <ClipboardList size={21} />}
              </button>
            )}
            {!isMobile && (
              <button
                className={`add-visit-button calendar-mobile-add-button ${overlayOpen || remindersVisible ? "mobile-calendar-action-hidden" : ""}`}
                type="button"
                onClick={() => onAdd({date: selectedDate})}>
                <Plus size={17} />
                Добавить
              </button>
            )}
          </div>
        }
        className="calendar-toolbar calendar-page-header"
        description={`${visitEntries.length} визитов запланировано`}
        headerActions={
          !isMobile ? (
            <button
              className="add-visit-button calendar-desktop-add-button"
              type="button"
              onClick={() => onAdd({date: selectedDate})}>
              <Plus size={17} />
              Добавить
            </button>
          ) : null
        }
        title="Календарь"
      />

      <div
        className="mobile-calendar-week"
        aria-label="Дни недели"
        ref={weekCarouselRef}>
        {carouselDates.map((date) => {
          const today = date === getTodayInput();
          const dayIndex = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
          return (
            <button
              className={`${date === selectedDate ? "selected" : ""} ${today ? "today" : ""}`}
              data-date={date}
              key={date}
              type="button"
              onClick={() => selectCalendarDate(date)}>
              <span>{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"][dayIndex]}</span>
              <b>{Number(date.slice(-2))}</b>
            </button>
          );
        })}
      </div>

      {isMobile && !isToday && (
        <button
          className={`calendar-today-button ${overlayOpen ? "mobile-calendar-action-hidden" : ""}`}
          type="button"
          onClick={() => selectCalendarDate(getTodayInput())}>
          Сегодня
        </button>
      )}

      <div className={`calendar-layout ${remindersVisible ? "" : "reminders-hidden"} ${showDayList ? "calendar-layout-day-list" : ""}`}>
        {showDayList && (
          <CalendarDayList
            clients={clients}
            entries={dayEntries}
            nextVisitId={nextVisitId}
            onAdd={() => onAdd({date: selectedDate})}
            onDelete={onDelete}
            onEdit={onEdit}
            onRemind={onRemind}
            onStatus={onStatus}
            onViewClient={setViewedClientEntry}
          />
        )}
        {showScheduleGrid && (
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
                    {employee.shiftStart || settings.workdayStart || "08:00"}–
                    {employee.shiftEnd || settings.workdayEnd || "22:00"}
                  </span>
                </header>
                <DroppableScheduleColumn
                  master={employee.name}
                  onPointerCancel={clearSlotLongPress}
                  onPointerDown={(event) => startSlotLongPress(event, employee.name)}
                  onPointerMove={moveSlotLongPress}
                  onPointerUp={clearSlotLongPress}>
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
                          className={`schedule-entry schedule-${entry.kind} schedule-status-${entry.status || "scheduled"} ${ended ? "schedule-entry-ended" : ""} ${isFocusedEntry(entry.id) ? "alert-focus-pulse" : ""}`}
                          domId={`alert-focus-calendar-${entry.id}`}
                          entry={entry}
                          key={entry.id}
                          style={{
                            "--entry-color": entry.color,
                            "--overlap-column": entry.overlapColumn,
                            "--overlap-count": entry.overlapCount,
                            height,
                            top,
                          }}>
                          {entry.kind === "visit" &&
                            entry.commissionType === "Booksy 45%" && (
                              <span className="schedule-entry-booksy-badge" title="Booksy 45%">
                                <Rocket size={16} strokeWidth={2.4} />
                              </span>
                            )}
                          <div className="schedule-entry-content">
                            <strong>{entry.kind === "visit" ? entry.client : entry.title}</strong>
                            <span>
                              {displayedEntry.time}–{getEntryEndTime(displayedEntry)}
                            </span>
                            {entry.kind === "visit" && <small>{entry.service}</small>}
                            {entry.kind === "visit" && (
                              <small
                                className={
                                  getVisitDebt(entry) > 0
                                    ? "schedule-entry-money schedule-entry-debt"
                                    : "schedule-entry-money"
                                }>
                                {getEntryMoneyLabel(entry)}
                              </small>
                            )}
                            {entry.kind === "visit" && entry.packageUsageId && (() => {
                              const packageItem = clientPackages.find(
                                (item) => item.id === entry.packageUsageId,
                              );
                              const plannedPosition = entries
                                .filter(
                                  (item) =>
                                    String(item.packageUsageId) ===
                                      String(entry.packageUsageId) &&
                                    isUpcomingPackageVisit(item),
                                )
                                .sort((first, second) =>
                                  `${first.date}T${first.time}`.localeCompare(
                                    `${second.date}T${second.time}`,
                                  ),
                                )
                                .findIndex((item) => item.id === entry.id) + 1;
                              return packageItem ? (
                                <small className="schedule-entry-package">
                                  Пакет {getPackageProgressLabel(
                                    packageItem,
                                    plannedPosition,
                                  )}
                                </small>
                              ) : null;
                            })()}
                            {entry.kind === "visit" && (
                              <b className="schedule-entry-status">
                                {["no_show", "cancelled"].includes(entry.status)
                                  ? statusLabels[entry.status]
                                  : ended
                                    ? "Окончен"
                                    : statusLabels[entry.status] || statusLabels.scheduled}
                              </b>
                            )}
                          </div>
                          <div className="schedule-entry-actions row-action-trigger-wrap">
                            <button
                              aria-label="Действия записи"
                              className="row-action-trigger"
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
        )}

        {showRemindersPanel && (
          <button
            aria-label="Закрыть ленту дня"
            className="mobile-calendar-reminders-backdrop"
            type="button"
            onClick={() => setRemindersVisible(false)}
          />
        )}
        {showRemindersPanel && <aside className="panel calendar-reminders">
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
                  <small
                    className={
                      getVisitDebt(entry) > 0
                        ? "calendar-reminder-money calendar-reminder-debt"
                        : "calendar-reminder-money"
                    }>
                    {getEntryMoneyLabel(entry)}
                  </small>
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
          isMobile={isMobile}
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
  isMobile,
  visits,
  onAdd,
  onClose,
  onRemind,
}) {
  const relatedEntries = entries.filter(
    (entry) =>
      entry.kind === "visit" &&
      matchesClientRecord(entry, [client].filter(Boolean), client ?? clientName) &&
      entry.id !== currentEntry.id,
  );
  const futureVisits = relatedEntries.filter(
    (entry) => `${entry.date}T${entry.time}` > `${currentEntry.date}T${currentEntry.time}`,
  );
  const pastVisits = visits.filter((visit) =>
    matchesClientRecord(visit, [client].filter(Boolean), client ?? clientName),
  );
  const packages = clientPackages.filter(
    (packageItem) =>
      matchesClientRecord(packageItem, [client].filter(Boolean), client ?? clientName) &&
      isActiveClientPackage(packageItem),
  );

  return (
    <MobileSheet
      className="calendar-client-card"
      fullscreen={isMobile}
      isOpen
      labelledBy="calendar-client-card-title"
      title={clientName}
      description={`${currentEntry.time}–${getEntryEndTime(currentEntry)} · ${currentEntry.service}`}
      onClose={onClose}
      footer={
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
      }>
      <span className="calendar-client-card-status">{client?.status || "Активный"}</span>
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
    </MobileSheet>
  );
}

export default CalendarPage;
