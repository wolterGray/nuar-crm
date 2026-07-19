import {getTodayInput} from "../../utils/dateHelpers.js";
import {normalizeCalendarEntryDate} from "../../utils/dateUtils.js";
import PageHeader from "../PageHeader.jsx";
import CalendarDayList from "../CalendarDayList.jsx";
import MobileSheet from "../MobileSheet.jsx";
import {AppIcon, Button, IconButton} from "../ui/index.js";
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

const employeeAccentPalette = ["#b91c1c", "#7aa2ff", "#88e071", "#ff5f5f", "#a78bfa", "#38bdf8"];
const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

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

function DraggableScheduleEntry({children, className, domId, entry, onOpen, style}) {
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
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(entry);
      }}
      {...listeners}
      {...attributes}>
      {children}
    </article>
  );
}

function CalendarPage({
  alertFocus,
  entries,
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
  const [calendarPanelMonth, setCalendarPanelMonth] = useState(
    () => getTodayInput().slice(0, 7),
  );
  const [now, setNow] = useState(new Date());
  const [mobileCalendarView, setMobileCalendarView] = useState("grid");
  const [remindersVisible, setRemindersVisible] = useState(
    () => !isMobileViewport() && (settings.calendarRemindersVisible ?? true),
  );
  const [reminderFilter, setReminderFilter] = useState("active");
  const [openEntryMenuId, setOpenEntryMenuId] = useState(null);
  const [openReminderMenuId, setOpenReminderMenuId] = useState(null);
  const [openCalendarPickerMenu, setOpenCalendarPickerMenu] = useState(null);
  const [viewedClientEntry, setViewedClientEntry] = useState(null);
  const [viewedReservedEntry, setViewedReservedEntry] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);
  const schedulePanelRef = useRef(null);
  const weekCarouselRef = useRef(null);
  const longPressRef = useRef(null);
  const pendingSlotOpenedAtRef = useRef(0);
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
  const calendarMasters = useMemo(() => {
    if (employees.length > 0) return employees;

    const entryMasters = Array.from(
      new Set(dayEntries.map((entry) => entry.master).filter(Boolean)),
    );

    if (entryMasters.length > 0) {
      return entryMasters.map((name, index) => ({
        id: `entry-master-${name}`,
        name,
        color: employeeAccentPalette[index % employeeAccentPalette.length],
        shiftStart: settings.workdayStart,
        shiftEnd: settings.workdayEnd,
      }));
    }

    return [
      {
        id: "calendar-master-placeholder",
        name: "Без мастера",
        color: employeeAccentPalette[0],
        shiftStart: settings.workdayStart,
        shiftEnd: settings.workdayEnd,
      },
    ];
  }, [dayEntries, employees, settings.workdayEnd, settings.workdayStart]);
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
  const employeeAccentByName = useMemo(
    () =>
      new Map(
        calendarMasters.map((employee, index) => [
          employee.name,
          employee.color || employeeAccentPalette[index % employeeAccentPalette.length],
        ]),
      ),
    [calendarMasters],
  );
  const calendarPanelDate = useMemo(
    () => new Date(`${calendarPanelMonth}-01T12:00:00`),
    [calendarPanelMonth],
  );
  const calendarPanelYear = calendarPanelDate.getFullYear();
  const calendarPanelMonthIndex = calendarPanelDate.getMonth();
  const calendarPanelYears = useMemo(
    () => Array.from({length: 11}, (_, index) => calendarPanelYear - 5 + index),
    [calendarPanelYear],
  );
  const calendarPanelDays = useMemo(() => {
    const year = calendarPanelDate.getFullYear();
    const month = calendarPanelDate.getMonth();
    const firstDay = new Date(year, month, 1, 12);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startOffset, 12);

    return Array.from({length: 42}, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      return {
        currentMonth: date.getMonth() === month,
        day: date.getDate(),
        value: date.toISOString().slice(0, 10),
      };
    });
  }, [calendarPanelDate]);
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
    setCalendarPanelMonth(nextDate.slice(0, 7));
  };
  const shiftCalendarPanelMonth = (offset) => {
    const nextDate = new Date(calendarPanelDate);
    nextDate.setMonth(nextDate.getMonth() + offset);
    setCalendarPanelMonth(nextDate.toISOString().slice(0, 7));
  };
  const setCalendarPanelPart = ({month = calendarPanelMonthIndex, year = calendarPanelYear}) => {
    setCalendarPanelMonth(`${year}-${String(month + 1).padStart(2, "0")}`);
    setOpenCalendarPickerMenu(null);
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

  useEffect(() => {
    if (!openCalendarPickerMenu && !openReminderMenuId && !openEntryMenuId) {
      return undefined;
    }

    const closeOpenMenus = (event) => {
      const target = event.target;

      if (!target.closest(".nuar-calendar-picker-menu")) {
        setOpenCalendarPickerMenu(null);
      }

      if (!target.closest(".nuar-calendar-reminder-menu")) {
        setOpenReminderMenuId(null);
      }

      if (!target.closest(".nuar-calendar-entry-menu")) {
        setOpenEntryMenuId(null);
      }
    };

    document.addEventListener("pointerdown", closeOpenMenus);
    return () => document.removeEventListener("pointerdown", closeOpenMenus);
  }, [openCalendarPickerMenu, openEntryMenuId, openReminderMenuId]);

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
        pendingSlotOpenedAtRef.current = Date.now();
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
    <section className="nuar-calendar flex flex-col flex-1 gap-3 min-h-0">
      <PageHeader
        actions={
          <div className="nuar-calendar-actions flex items-center gap-2">
            <div className="nuar-calendar-date-nav flex items-center gap-1.5">
              <IconButton
                className="nuar-calendar-nav-button"
                icon="chevronLeft"
                label="Предыдущий день"
                size="md"
                variant="outline"
                onClick={() => selectCalendarDate(shiftDate(selectedDate, -1))}
              />
              <span className="nuar-calendar-date-display">
                {toDisplayDate(selectedDate)}
              </span>
              <IconButton
                className="nuar-calendar-nav-button"
                icon="chevronRight"
                label="Следующий день"
                size="md"
                variant="outline"
                onClick={() => selectCalendarDate(shiftDate(selectedDate, 1))}
              />
            </div>
            {!isToday && !isMobile && (
              <Button
                className="nuar-calendar-today-button"
                size="sm"
                variant="outline"
                onClick={() => selectCalendarDate(getTodayInput())}
              >
                Сегодня
              </Button>
            )}
            {!remindersVisible && !showDayList && (
              <IconButton
                className="nuar-calendar-feed-button"
                icon="chevronLeft"
                label="Открыть ленту дня"
                size="md"
                variant="outline"
                onClick={() => setRemindersVisible(true)}
              />
            )}
            {isMobile && (
              <IconButton
                className={overlayOpen ? "hidden" : ""}
                icon={showDayList ? "layoutGrid" : "list"}
                label={showDayList ? "Показать сетку" : "Показать список"}
                size="md"
                variant="outline"
                onClick={() =>
                  setMobileCalendarView((current) => (current === "list" ? "grid" : "list"))
                }
              />
            )}
            {!isMobile && (
              <IconButton
                className={overlayOpen ? "hidden" : ""}
                icon={remindersVisible ? "x" : "clipboardCheck"}
                label={remindersVisible ? "Скрыть ленту дня" : "Открыть ленту дня"}
                size="md"
                variant="outline"
                onClick={() => setRemindersVisible((current) => !current)}
              />
            )}
            {!isMobile && (
              <Button
                className={`nuar-calendar-add-button ${
                  overlayOpen || remindersVisible ? "hidden" : ""
                }`}
                leftIcon="plus"
                size="sm"
                variant="primary"
                onClick={() => onAdd({date: selectedDate})}
              >
                Добавить
              </Button>
            )}
          </div>
        }
        className="nuar-calendar-header"
        description={`${visitEntries.length} визитов запланировано`}
        headerActions={null}
        title="Календарь"
      />

      <div
        className="mobile-calendar-week hidden max-md:grid"
        aria-label="Дни недели"
        ref={weekCarouselRef}
      >
        {carouselDates.map((date) => {
          const today = date === getTodayInput();
          const dayIndex = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
          const isSelected = date === selectedDate;
          return (
            <button
              className={`${isSelected ? "selected" : ""} ${today ? "today" : ""}`}
              data-date={date}
              key={date}
              type="button"
              onClick={() => selectCalendarDate(date)}
            >
              <span>
                {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"][dayIndex]}
              </span>
              <b>
                {Number(date.slice(-2))}
              </b>
            </button>
          );
        })}
      </div>

      {isMobile && !isToday && (
        <Button
          className={`nuar-calendar-floating-today ${
            overlayOpen ? "hidden" : ""
          }`}
          size="sm"
          variant="subtle"
          onClick={() => selectCalendarDate(getTodayInput())}
        >
          Сегодня
        </Button>
      )}

      <div
        className={`nuar-calendar-layout gap-3 flex-1 items-stretch min-h-0 ${
          showDayList
            ? "flex flex-col"
            : `grid ${remindersVisible ? "grid-cols-[1fr_320px]" : "grid-cols-[1fr]"}`
        }`}
      >
        {showDayList && (
          <div className="nuar-calendar-day-list flex-1 w-full min-w-0 overflow-y-auto px-4 pb-20">
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
              onViewReserved={setViewedReservedEntry}
            />
          </div>
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
            }}
          >
            <section
              className={`nuar-calendar-schedule min-w-0 min-h-0 max-h-full p-0 overscroll-contain scrollbar-thin ${
                isMobile ? "overflow-y-auto overflow-x-hidden" : "overflow-auto"
              }`}
              ref={schedulePanelRef}
            >
              <div
                className={`nuar-calendar-grid grid select-none ${
                  isMobile ? "w-full min-w-0" : "min-w-[700px]"
                }`}
                style={{
                  gridTemplateColumns: isMobile
                    ? `var(--calendar-time-axis-width, 44px) repeat(${calendarMasters.length}, minmax(0, 1fr))`
                    : `58px repeat(${calendarMasters.length}, minmax(190px, 1fr))`,
                  width: "100%",
                  "--master-count": calendarMasters.length,
                  "--calendar-time-axis-width": isMobile ? "44px" : "58px",
                  "--mobile-master-width": "minmax(0, 1fr)",
                  "--schedule-height": `${gridHeight}px`,
                  "--schedule-hour-height": `${(60 / slotMinutes) * slotHeight}px`,
                }}
              >
                <div
                  className="nuar-calendar-time-axis sticky left-0 z-10 pt-12"
                  style={{ height: `${gridHeight + 48}px` }}
                >
                  {Array.from({length: endHour - startHour}, (_, index) => (
                    <div className="relative" style={{ height: `${(60 / slotMinutes) * slotHeight}px` }} key={index}>
                      <strong>
                        {String(startHour + index).padStart(2, "0")}:00
                      </strong>
                      {Array.from({length: 60 / slotMinutes - 1}, (_, slotIndex) => (
                        <span
                          key={slotIndex}
                          className="nuar-calendar-minute-label"
                          style={{ top: `${(slotIndex + 1) * slotHeight}px` }}
                        >
                          {(slotIndex + 1) * slotMinutes}
                        </span>
                      ))}
                    </div>
                  ))}
                  <strong>
                    {String(endHour).padStart(2, "0")}:00
                  </strong>
                </div>
                {calendarMasters.map((employee, empIndex) => (
                  <div className="nuar-calendar-master min-w-0" key={employee.id}>
                    <header className="nuar-calendar-master-header sticky top-0 z-12">
                      <strong>
                        <span
                          className="nuar-calendar-master-dot"
                          style={{backgroundColor: employeeAccentByName.get(employee.name)}}
                          aria-hidden="true"
                        />
                        {employee.name}
                      </strong>
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
                      onPointerUp={clearSlotLongPress}
                    >
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
                              <div
                                className="schedule-off-hours schedule-off-hours-before absolute right-0 left-0 z-1 pointer-events-none"
                                style={{height: topHeight, top: 0}}
                              />
                            )}
                            {bottomTop < gridHeight && (
                              <div
                                className="schedule-off-hours schedule-off-hours-after absolute right-0 left-0 z-1 pointer-events-none"
                                style={{height: gridHeight - bottomTop, top: bottomTop}}
                              />
                            )}
                          </>
                        );
                      })()}
                      {settings.calendarNowLineVisible && isToday && currentTop >= 0 && currentTop <= gridHeight && (
                        <div className="nuar-calendar-now-line absolute right-0 left-0 z-5 pointer-events-none" style={{top: currentTop}}>
                          {empIndex === 0 && (
                            <>
                              <i
                                className="nuar-calendar-now-dot absolute rounded-full"
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  left: "-3px",
                                  top: "-2.5px"
                                }}
                              />
                              <span className="nuar-calendar-now-label absolute top-[-18px] left-1.5">
                                {toTime(currentMinutes, startMinutes, endMinutes, slotMinutes)}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      <div className="absolute inset-0 z-2 pointer-events-none" aria-hidden="true">
                        {Array.from(
                          {length: minutesInDay / slotMinutes},
                          (_, index) => (
                            <i
                              className={`absolute right-0 left-0 border-t ${
                                index % (60 / slotMinutes) === 0 ? "is-hour" : "is-quarter"
                              }`}
                              key={index}
                              style={{top: index * slotHeight}}
                            />
                          ),
                        )}
                      </div>
                      {layoutOverlappingEntries(
                        dayEntries.filter((entry) => entry.master === employee.name),
                      ).map((entry) => {
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
                            className={`nuar-calendar-entry-block ${
                              entry.kind === "task" ? "border-dashed" : "border-solid"
                            } ${ended ? "opacity-80" : ""} ${
                              isFocusedEntry(entry.id) ? "animate-pulse" : ""
                            }`}
                            domId={`alert-focus-calendar-${entry.id}`}
                            entry={entry}
                            key={entry.id}
                            onOpen={(item) => {
                              if (item.kind === "visit") {
                                setViewedClientEntry(item);
                                return;
                              }
                              if (item.kind === "reserved") {
                                setViewedReservedEntry(item);
                              }
                            }}
                            style={{
                              borderLeftColor: entry.color,
                              backgroundColor: `${entry.color}26`,
                              left: `calc((100% / ${entry.overlapCount || 1}) * ${entry.overlapColumn || 0} + 4px)`,
                              height,
                              top,
                            }}
                          >
                            {entry.kind === "visit" &&
                              entry.commissionType === "Booksy 45%" && (
                                <span className="nuar-calendar-booksy-badge absolute top-1.5 right-6 inline-flex w-4 h-4 items-center justify-center rounded-full pointer-events-none z-10">
                                  <AppIcon name="rocket" size="xs" strokeWidth={2.4} />
                                </span>
                              )}
                            <div className="nuar-calendar-entry-content">
                              <strong className="nuar-calendar-entry-title">
                                {entry.kind === "visit" ? entry.client : entry.title}
                              </strong>
                              <span className="nuar-calendar-entry-time">
                                {displayedEntry.time}–{getEntryEndTime(displayedEntry)}
                              </span>
                              {entry.kind === "visit" && (
                                <small className="nuar-calendar-entry-service">
                                  {entry.service}
                                </small>
                              )}
                              {entry.kind === "visit" && (
                                <small
                                  className={`nuar-calendar-entry-money ${
                                    getVisitDebt(entry) > 0 ? "is-debt" : "is-paid"
                                  }`}
                                >
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
                                  <small className="nuar-calendar-package-label">
                                    Пакет {getPackageProgressLabel(packageItem, plannedPosition)}
                                  </small>
                                ) : null;
                              })()}
                              {entry.kind === "visit" && (
                                <b className="nuar-calendar-status-pill">
                                  {["no_show", "cancelled"].includes(entry.status)
                                    ? statusLabels[entry.status]
                                    : ended
                                    ? "Окончен"
                                    : statusLabels[entry.status] || statusLabels.scheduled}
                                </b>
                              )}
                            </div>
                            <div className="nuar-calendar-entry-menu absolute top-1 right-1 opacity-0 hover:opacity-100 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex flex-col gap-1 z-10">
                              <IconButton
                                className="nuar-calendar-entry-trigger"
                                icon="moreVertical"
                                label="Действия записи"
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenEntryMenuId((current) =>
                                    current === entry.id ? null : entry.id,
                                  );
                                }}
                              />
                              {openEntryMenuId === entry.id && (
                                <div className="nuar-calendar-entry-popover">
                                  {entry.kind === "visit" && activeVisit && (
                                    <Button
                                      className="nuar-calendar-entry-action"
                                      leftIcon="bellRing"
                                      size="sm"
                                      variant="ghost"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onRemind(entry);
                                      }}
                                    >
                                      Напомнить
                                    </Button>
                                  )}
                                  {activeVisit && (
                                    <Button
                                      className="nuar-calendar-entry-action is-danger"
                                      leftIcon="ban"
                                      size="sm"
                                      variant="ghost"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        onStatus(entry, "cancelled");
                                      }}
                                    >
                                      Отменить
                                    </Button>
                                  )}
                                  <Button
                                    className="nuar-calendar-entry-action"
                                    leftIcon="edit"
                                    size="sm"
                                    variant="ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onEdit(entry);
                                    }}
                                  >
                                    Редактировать
                                  </Button>
                                  <Button
                                    className="nuar-calendar-entry-action is-danger"
                                    leftIcon="trash"
                                    size="sm"
                                    variant="ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onDelete(entry);
                                    }}
                                  >
                                    Удалить
                                  </Button>
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
              <div className="nuar-calendar-drag-preview fixed right-6 bottom-6 z-50 pointer-events-none">
                <strong>
                  {dragPreview.time}–{dragPreview.endTime}
                </strong>
                <span>{dragPreview.master}</span>
              </div>
            )}
          </DndContext>
        )}

        {showRemindersPanel && (
          <button
            aria-label="Закрыть ленту дня"
            className="nuar-calendar-reminders-backdrop fixed inset-0 z-30 block md:hidden"
            type="button"
            onClick={() => setRemindersVisible(false)}
          />
        )}
        {showRemindersPanel && (
          <aside className="nuar-calendar-reminders min-h-0 overflow-y-auto flex flex-col gap-3">
            <section className="nuar-calendar-picker" aria-label="Календарь месяца">
              <header>
                <IconButton
                  aria-label="Предыдущий месяц"
                  icon="chevronLeft"
                  size="sm"
                  variant="ghost"
                  onClick={() => shiftCalendarPanelMonth(-1)}
                />
                <div className="nuar-calendar-picker-title">
                  <div className="nuar-calendar-picker-menu">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setOpenCalendarPickerMenu((current) =>
                          current === "month" ? null : "month",
                        )
                      }
                    >
                      {monthNames[calendarPanelMonthIndex]}
                    </Button>
                    {openCalendarPickerMenu === "month" ? (
                      <div className="nuar-calendar-picker-popover is-month">
                        {monthNames.map((month, index) => (
                          <Button
                            className={index === calendarPanelMonthIndex ? "is-selected" : ""}
                            key={month}
                            size="sm"
                            variant="ghost"
                            onClick={() => setCalendarPanelPart({month: index})}
                          >
                            {month}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="nuar-calendar-picker-menu">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setOpenCalendarPickerMenu((current) =>
                          current === "year" ? null : "year",
                        )
                      }
                    >
                      {calendarPanelYear}
                    </Button>
                    {openCalendarPickerMenu === "year" ? (
                      <div className="nuar-calendar-picker-popover is-year">
                        {calendarPanelYears.map((year) => (
                          <Button
                            className={year === calendarPanelYear ? "is-selected" : ""}
                            key={year}
                            size="sm"
                            variant="ghost"
                            onClick={() => setCalendarPanelPart({year})}
                          >
                            {year}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <IconButton
                  aria-label="Следующий месяц"
                  icon="chevronRight"
                  size="sm"
                  variant="ghost"
                  onClick={() => shiftCalendarPanelMonth(1)}
                />
              </header>
              <div className="nuar-calendar-picker-weekdays" aria-hidden="true">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="nuar-calendar-picker-grid">
                {calendarPanelDays.map((day) => (
                  <button
                    className={`${day.currentMonth ? "" : "is-muted"} ${
                      day.value === selectedDate ? "is-selected" : ""
                    } ${day.value === getTodayInput() ? "is-today" : ""}`}
                    key={day.value}
                    type="button"
                    onClick={() => selectCalendarDate(day.value)}
                  >
                    {day.day}
                  </button>
                ))}
              </div>
            </section>
            <div className="nuar-calendar-reminders-header flex items-center justify-between">
              <div>
                <h2>Лента дня</h2>
                <p>{toDisplayDate(selectedDate)}</p>
              </div>
              <IconButton
                icon="chevronRight"
                label="Скрыть ленту дня"
                size="sm"
                variant="outline"
                onClick={() => setRemindersVisible(false)}
              />
            </div>
            <div className="nuar-calendar-reminder-stats flex flex-wrap">
              <span>
                <b>{visitEntries.length}</b> всего
              </span>
              <span>
                <b>{activeVisitEntries.length}</b> активных
              </span>
              <span>
                <b>{completedVisitEntries.length}</b> окончено
              </span>
            </div>
            <div className="nuar-calendar-reminder-filter flex">
              <Button
                className={reminderFilter === "active" ? "is-active" : ""}
                size="sm"
                variant="ghost"
                onClick={() => setReminderFilter("active")}
              >
                Активные
              </Button>
              <Button
                className={reminderFilter === "all" ? "is-active" : ""}
                size="sm"
                variant="ghost"
                onClick={() => setReminderFilter("all")}
              >
                Все
              </Button>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {visibleReminderEntries.map((entry) => {
                const activeVisit = isEntryActive(entry, selectedDate, now);

                return (
                  <article
                    className={`nuar-calendar-reminder-card ${
                      entry.id === nextVisitId ? "is-next" : ""
                    }`}
                    key={entry.id}
                  >
                    <div className="nuar-calendar-reminder-main">
                      <span className="nuar-calendar-reminder-time">
                        {entry.time}
                      </span>
                      <Button
                        className="nuar-calendar-reminder-client"
                        size="sm"
                        title="Открыть карточку клиента"
                        variant="link"
                        onClick={() => setViewedClientEntry(entry)}
                      >
                        {entry.client}
                      </Button>
                      <span className={`nuar-calendar-reminder-money ${getVisitDebt(entry) > 0 ? "is-debt" : ""}`}>
                        {getEntryMoneyLabel(entry)}
                      </span>
                    </div>
                    <div className="nuar-calendar-reminder-meta">
                      <span>{entry.service}</span>
                      <span>{entry.time}–{getEntryEndTime(entry)}</span>
                      <span>{entry.master}</span>
                      <span>{activeVisit ? statusLabels[entry.status] || statusLabels.scheduled : statusLabels[entry.status] || "Окончен"}</span>
                    </div>
                    <div className="nuar-calendar-reminder-menu">
                      <IconButton
                        icon="moreVertical"
                        label="Действия визита"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setOpenReminderMenuId((current) =>
                            current === entry.id ? null : entry.id,
                          )
                        }
                      />
                      {openReminderMenuId === entry.id && (
                        <div className="nuar-calendar-reminder-popover">
                          {activeVisit && (
                            <Button
                              leftIcon="message"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setOpenReminderMenuId(null);
                                onRemind(entry);
                              }}
                            >
                              Напомнить
                            </Button>
                          )}
                          <Button
                            leftIcon="edit"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setOpenReminderMenuId(null);
                              onEdit(entry);
                            }}
                          >
                            Редактировать
                          </Button>
                          <Button
                            className="is-danger"
                            leftIcon="trash"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setOpenReminderMenuId(null);
                              onDelete(entry);
                            }}
                          >
                            Удалить
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {visibleReminderEntries.length === 0 && (
                <p className="nuar-calendar-reminders-empty">
                  {visitEntries.length === 0 ? "На этот день визитов пока нет." : "Активных визитов больше нет."}
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      {pendingSlot && (
        <div
          className="nuar-calendar-add-backdrop fixed inset-0 z-50 grid place-items-center p-4 select-none"
          role="presentation"
          onClick={() => {
            if (Date.now() - pendingSlotOpenedAtRef.current < 450) {
              return;
            }
            setPendingSlot(null);
          }}
        >
          <section
            aria-label="Добавить запись"
            className="nuar-calendar-add-popover"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              className="nuar-calendar-add-option"
              leftIcon={<AppIcon name="calendarPlus" size="md" />}
              variant="ghost"
              onClick={() => {
                onAdd({...pendingSlot, kind: "visit"});
                setPendingSlot(null);
              }}
            >
              <span>
                <strong>Новый визит</strong>
                <small>Записать клиента</small>
              </span>
            </Button>
            <Button
              className="nuar-calendar-add-option"
              leftIcon={<AppIcon name="ban" size="md" />}
              variant="ghost"
              onClick={() => {
                onAdd({...pendingSlot, kind: "reserved"});
                setPendingSlot(null);
              }}
            >
              <span>
                <strong>Зарезервировать время</strong>
                <small>Закрыть слот без клиента</small>
              </span>
            </Button>
          </section>
        </div>
      )}
      {viewedClientEntry && (
        <ClientCalendarCard
          client={clients.find((client) => client.name === viewedClientEntry.client)}
          clientName={viewedClientEntry.client}
          currentEntry={viewedClientEntry}
          isMobile={isMobile}
          onAdd={() => {
            onAdd({date: selectedDate, client: viewedClientEntry.client});
            setViewedClientEntry(null);
          }}
          onClose={() => setViewedClientEntry(null)}
          onEdit={() => {
            onEdit(viewedClientEntry);
            setViewedClientEntry(null);
          }}
          onRemind={() => onRemind(viewedClientEntry)}
        />
      )}
      {viewedReservedEntry && (
        <ReservedCalendarCard
          entry={viewedReservedEntry}
          isMobile={isMobile}
          onClose={() => setViewedReservedEntry(null)}
          onDelete={() => {
            onDelete(viewedReservedEntry);
            setViewedReservedEntry(null);
          }}
          onEdit={() => {
            onEdit(viewedReservedEntry);
            setViewedReservedEntry(null);
          }}
        />
      )}
    </section>
  );
}

function ClientCalendarCard({
  client,
  clientName,
  currentEntry,
  isMobile,
  onAdd,
  onClose,
  onEdit,
  onRemind,
}) {
  const entryStatus =
    statusLabels[currentEntry.status] ||
    (currentEntry.status === "completed" ? "Окончен" : statusLabels.scheduled);
  const duration = Number(currentEntry.duration || 0);
  const serviceAmount =
    currentEntry.amount !== undefined &&
    currentEntry.amount !== null &&
    String(currentEntry.amount).trim() !== ""
      ? formatMoney(currentEntry.amount)
      : "—";
  const paymentTotal = getEntryMoneyLabel(currentEntry);
  const hasDebt = getVisitDebt(currentEntry) > 0;
  const note = String(currentEntry.note || "").trim();
  const clientContact = client?.phone || currentEntry.phone || "Телефон не указан";
  const visitMeta = [
    {
      icon: "clock",
      label: "Время",
      value: `${currentEntry.time}–${getEntryEndTime(currentEntry)}`,
      detail: duration ? `${duration} мин` : "Длительность не указана",
    },
    {
      icon: "creditCard",
      label: "Стоимость",
      value: paymentTotal,
      detail: hasDebt ? `Стоимость услуги ${serviceAmount}` : currentEntry.payment || "Оплата не указана",
      tone: hasDebt ? "danger" : "",
    },
    {
      icon: "userRound",
      label: "Мастер",
      value: currentEntry.master || "—",
      detail: currentEntry.commissionType || "Без комиссии",
    },
    {
      icon: "phone",
      label: "Клиент",
      value: clientName,
      detail: clientContact,
    },
  ];

  return (
    <MobileSheet
      className="calendar-client-card"
      fullscreen={isMobile}
      isOpen
      labelledBy="calendar-client-card-title"
      title={clientName}
      description={`${currentEntry.time}–${getEntryEndTime(currentEntry)} · ${currentEntry.service}`}
      onClose={onClose}>
      <section
        className="calendar-visit-summary"
        style={{"--visit-accent": currentEntry.color || "var(--button-primary-bg, #dc2626)"}}>
        <div className="calendar-visit-summary-top">
          <span className="calendar-client-card-status">{entryStatus}</span>
          <b>{toDisplayDate(currentEntry.date)}</b>
        </div>
        <h3>{currentEntry.service || "Услуга не указана"}</h3>
        <div className="calendar-visit-summary-bottom">
          <span>{currentEntry.time}–{getEntryEndTime(currentEntry)}</span>
          <strong>{duration ? `${duration} мин` : "—"}</strong>
          <strong className={hasDebt ? "is-debt" : ""}>{paymentTotal}</strong>
        </div>
      </section>
      <div className="calendar-client-card-actions">
        <Button leftIcon="edit" size="sm" type="button" variant="primary" onClick={onEdit}>
          Редактировать
        </Button>
        <Button leftIcon="message" size="sm" type="button" variant="secondary" onClick={onRemind}>
          Написать
        </Button>
        <Button leftIcon="calendarPlus" size="sm" type="button" variant="secondary" onClick={onAdd}>
          Новая запись
        </Button>
      </div>
      <div className="calendar-visit-detail-grid">
        {visitMeta.map((item) => (
          <span className={item.tone ? `is-${item.tone}` : ""} key={item.label}>
            <AppIcon name={item.icon} size="sm" />
            <small>{item.label}</small>
            <strong>{item.value}</strong>
            <em>{item.detail}</em>
          </span>
        ))}
      </div>
      <div className="calendar-client-card-note">
        <strong>Комментарий к визиту</strong>
        <p>{note || "Комментария к этой записи нет."}</p>
      </div>
    </MobileSheet>
  );
}

function ReservedCalendarCard({
  entry,
  isMobile,
  onClose,
  onDelete,
  onEdit,
}) {
  return (
    <MobileSheet
      className="calendar-reserved-card"
      fullscreen={isMobile}
      isOpen
      labelledBy="calendar-reserved-card-title"
      title={entry.title || "Резерв"}
      description={`${entry.time}–${getEntryEndTime(entry)} · ${entry.master || "Мастер не указан"}`}
      onClose={onClose}
      footer={
        <div className="calendar-reserved-card-actions">
          <Button leftIcon="edit" size="sm" type="button" variant="secondary" onClick={onEdit}>
            Редактировать
          </Button>
          <Button leftIcon="trash" size="sm" type="button" variant="danger" onClick={onDelete}>
            Удалить
          </Button>
        </div>
      }>
      <div className="calendar-reserved-card-panel">
        <span>
          <b>Время</b>
          <strong>{entry.time}–{getEntryEndTime(entry)}</strong>
        </span>
        <span>
          <b>Мастер</b>
          <strong>{entry.master || "—"}</strong>
        </span>
        <span>
          <b>Статус</b>
          <strong>Зарезервировано</strong>
        </span>
        <span>
          <b>Дата</b>
          <strong>{toDisplayDate(entry.date)}</strong>
        </span>
      </div>
      {entry.comment || entry.notes ? (
        <div className="calendar-client-card-note">
          <strong>Комментарий</strong>
          <p>{entry.comment || entry.notes}</p>
        </div>
      ) : null}
    </MobileSheet>
  );
}

export default CalendarPage;
