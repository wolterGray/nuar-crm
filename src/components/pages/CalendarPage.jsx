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
  const [dragPreview, setDragPreview] = useState(null);
  const [pendingSlot, setPendingSlot] = useState(null);
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
  const employeeAccentByName = useMemo(
    () =>
      new Map(
        employees.map((employee, index) => [
          employee.name,
          employee.color || employeeAccentPalette[index % employeeAccentPalette.length],
        ]),
      ),
    [employees],
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
    <section className="nuar-calendar flex flex-col flex-1 gap-3 min-h-0 text-zinc-200">
      <PageHeader
        actions={
          <div className="nuar-calendar-actions flex items-center gap-2">
            <div className="nuar-calendar-date-nav flex items-center gap-1.5">
              <button
                aria-label="Предыдущий день"
                className="grid w-9 h-9 place-items-center border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                type="button"
                onClick={() => selectCalendarDate(shiftDate(selectedDate, -1))}
              >
                <ChevronLeft size={17} />
              </button>
              <span className="nuar-calendar-date-display">
                {toDisplayDate(selectedDate)}
              </span>
              <button
                aria-label="Следующий день"
                className="grid w-9 h-9 place-items-center border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                type="button"
                onClick={() => selectCalendarDate(shiftDate(selectedDate, 1))}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            {!isToday && !isMobile && (
              <button
                className="inline-flex items-center min-h-[38px] px-4 py-1.5 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-350 bg-zinc-900/50 hover:bg-zinc-800 cursor-pointer"
                type="button"
                onClick={() => selectCalendarDate(getTodayInput())}
              >
                Сегодня
              </button>
            )}
            {!remindersVisible && !showDayList && (
              <button
                aria-label="Открыть ленту дня"
                className="grid w-9 h-9 place-items-center border border-zinc-800 rounded-lg text-zinc-400 bg-zinc-900/50 hover:bg-zinc-800 cursor-pointer"
                title="Открыть ленту дня"
                type="button"
                onClick={() => setRemindersVisible(true)}
              >
                <ChevronLeft size={17} />
              </button>
            )}
            {isMobile && (
              <button
                aria-label={showDayList ? "Показать сетку" : "Показать список"}
                className={`grid w-9 h-9 place-items-center border border-zinc-800 rounded-lg text-zinc-400 bg-zinc-900/50 hover:bg-zinc-800 cursor-pointer ${
                  overlayOpen ? "hidden" : ""
                }`}
                title={showDayList ? "Сетка" : "Список"}
                type="button"
                onClick={() =>
                  setMobileCalendarView((current) => (current === "list" ? "grid" : "list"))
                }
              >
                {showDayList ? <LayoutGrid size={20} /> : <List size={20} />}
              </button>
            )}
            {!isMobile && (
              <button
                aria-label={remindersVisible ? "Скрыть ленту дня" : "Открыть ленту дня"}
                className={`grid w-9 h-9 place-items-center border border-zinc-800 rounded-lg text-zinc-400 bg-zinc-900/50 hover:bg-zinc-850 cursor-pointer ${
                  overlayOpen ? "hidden" : ""
                }`}
                title="Лента дня"
                type="button"
                onClick={() => setRemindersVisible((current) => !current)}
              >
                {remindersVisible ? <X size={20} /> : <ClipboardList size={18} />}
              </button>
            )}
            {!isMobile && (
              <button
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 border border-red-800 rounded-lg text-xs font-semibold text-white bg-red-800 hover:bg-red-900 cursor-pointer transition-colors ${
                  overlayOpen || remindersVisible ? "hidden" : ""
                }`}
                type="button"
                onClick={() => onAdd({date: selectedDate})}
              >
                <Plus size={16} />
                Добавить
              </button>
            )}
          </div>
        }
        className="nuar-calendar-header border-b border-zinc-800/60 pb-2"
        description={`${visitEntries.length} визитов запланировано`}
        headerActions={null}
        title="Календарь"
      />

      <div
        className="hidden max-md:grid grid-flow-col auto-cols-[calc((100%-24px)/7)] h-16 shrink-0 gap-1 overflow-x-auto border-b border-zinc-805/60 bg-zinc-950/20 p-2 scroll-snap-x scrollbar-none touch-pan-x"
        aria-label="Дни недели"
        ref={weekCarouselRef}
      >
        {carouselDates.map((date) => {
          const today = date === getTodayInput();
          const dayIndex = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
          const isSelected = date === selectedDate;
          return (
            <button
              className={`grid grid-rows-[13px_28px] min-h-[50px] place-items-center align-content-center gap-0.5 border-0 rounded-lg text-zinc-400 bg-transparent scroll-snap-start cursor-pointer transition-colors ${
                isSelected ? "text-red-300 font-bold" : ""
              }`}
              data-date={date}
              key={date}
              type="button"
              onClick={() => selectCalendarDate(date)}
            >
              <span className="block text-[9px] text-zinc-500 uppercase font-semibold leading-tight">
                {["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"][dayIndex]}
              </span>
              <b
                className={`grid w-7 h-7 place-items-center rounded-full text-sm transition-all ${
                  isSelected
                    ? "bg-red-800 text-white font-bold"
                    : today
                    ? "border border-zinc-800 text-red-300 font-bold"
                    : "text-zinc-300"
                }`}
              >
                {Number(date.slice(-2))}
              </b>
            </button>
          );
        })}
      </div>

      {isMobile && !isToday && (
        <button
          className={`fixed bottom-20 right-4 z-40 px-4 py-2 border border-zinc-800 rounded-full text-xs font-semibold text-zinc-200 bg-zinc-900 shadow-lg cursor-pointer ${
            overlayOpen ? "hidden" : ""
          }`}
          type="button"
          onClick={() => selectCalendarDate(getTodayInput())}
        >
          Сегодня
        </button>
      )}

      <div
        className={`nuar-calendar-layout grid gap-3 flex-1 items-stretch min-h-0 ${
          remindersVisible ? "grid-cols-[1fr_320px]" : "grid-cols-[1fr]"
        } ${showDayList ? "flex flex-col" : ""}`}
      >
        {showDayList && (
          <div className="flex-1 overflow-y-auto px-4 pb-20">
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
              className="nuar-calendar-schedule min-w-0 min-h-0 max-h-full overflow-auto p-0 overscroll-contain scrollbar-thin rounded-xl border border-zinc-800/80 bg-zinc-950/20"
              ref={schedulePanelRef}
            >
              <div
                className="nuar-calendar-grid grid min-w-[700px] select-none"
                style={{
                  gridTemplateColumns: `58px repeat(${employees.length}, minmax(190px, 1fr))`,
                  width: `calc(58px + ${employees.length} * var(--mobile-master-width, 190px))`,
                  "--master-count": employees.length,
                  "--mobile-master-width": isMobile
                    ? `calc((100vw - 24px) / ${Math.min(Math.max(employees.length, 1), 2)})`
                    : "1fr",
                  "--schedule-height": `${gridHeight}px`,
                  "--schedule-hour-height": `${(60 / slotMinutes) * slotHeight}px`,
                }}
              >
                <div
                  className="nuar-calendar-time-axis sticky left-0 z-10 pt-12 text-zinc-500 bg-zinc-950/95"
                  style={{ height: `${gridHeight + 48}px` }}
                >
                  {Array.from({length: endHour - startHour}, (_, index) => (
                    <div className="relative" style={{ height: `${(60 / slotMinutes) * slotHeight}px` }} key={index}>
                      <strong className="block px-1.5 text-[10px] font-bold text-zinc-400 tracking-tight transform translateY-[-7px]">
                        {String(startHour + index).padStart(2, "0")}:00
                      </strong>
                      {Array.from({length: 60 / slotMinutes - 1}, (_, slotIndex) => (
                        <span
                          key={slotIndex}
                          className="absolute right-2 text-[9px] text-zinc-600 font-medium"
                          style={{ top: `${(slotIndex + 1) * slotHeight}px` }}
                        >
                          {(slotIndex + 1) * slotMinutes}
                        </span>
                      ))}
                    </div>
                  ))}
                  <strong className="block px-1.5 text-[10px] font-bold text-zinc-400 transform translateY-[-7px]">
                    {String(endHour).padStart(2, "0")}:00
                  </strong>
                </div>
                {employees.map((employee) => (
                  <div className="nuar-calendar-master min-w-0 border-l border-zinc-800/80" key={employee.id}>
                    <header className="nuar-calendar-master-header sticky top-0 z-12 grid h-12 align-content-center gap-0.5 px-3 bg-zinc-900 border-b border-zinc-850">
                      <strong className="text-zinc-200 text-xs font-semibold truncate">
                        <span
                          className="nuar-calendar-master-dot"
                          style={{backgroundColor: employeeAccentByName.get(employee.name)}}
                          aria-hidden="true"
                        />
                        {employee.name}
                      </strong>
                      <span className="text-zinc-500 text-[10px]">
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
                                className="absolute right-0 left-0 z-1 pointer-events-none bg-zinc-900/20 border-b border-zinc-900/60"
                                style={{height: topHeight, top: 0}}
                              />
                            )}
                            {bottomTop < gridHeight && (
                              <div
                                className="absolute right-0 left-0 z-1 pointer-events-none bg-zinc-900/20 border-t border-zinc-900/60"
                                style={{height: gridHeight - bottomTop, top: bottomTop}}
                              />
                            )}
                          </>
                        );
                      })()}
                      {settings.calendarNowLineVisible && isToday && currentTop >= 0 && currentTop <= gridHeight && (
                        <div className="absolute right-0 left-0 z-5 h-[1px] bg-red-500 pointer-events-none" style={{top: currentTop}}>
                          <i className="absolute top-[-4px] left-[-4px] w-2.5 h-2.5 rounded-full bg-red-500" />
                          <span className="absolute top-[-18px] left-1 text-red-400 text-[9px] font-bold">
                            {toTime(currentMinutes, startMinutes, endMinutes, slotMinutes)}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 z-2 pointer-events-none" aria-hidden="true">
                        {Array.from(
                          {length: minutesInDay / slotMinutes},
                          (_, index) => (
                            <i
                              className={`absolute right-0 left-0 border-t ${
                                index % (60 / slotMinutes) === 0 ? "border-solid border-zinc-800/80" : "border-dashed border-zinc-900"
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
                            className={`absolute z-3 flex flex-col items-stretch justify-start gap-1 p-2 overflow-hidden border-l-4 rounded-lg cursor-grab select-none w-[calc(100%/var(--overlap-count,1)-8px)] ${
                              entry.kind === "task" ? "border-dashed" : "border-solid"
                            } ${ended ? "opacity-80" : ""} ${
                              isFocusedEntry(entry.id) ? "animate-pulse" : ""
                            }`}
                            domId={`alert-focus-calendar-${entry.id}`}
                            entry={entry}
                            key={entry.id}
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
                                <span className="nuar-calendar-booksy-badge absolute top-1.5 right-6 inline-flex w-4 h-4 items-center justify-center rounded-full text-red-300 bg-red-900/20 border border-red-800/40 pointer-events-none z-10">
                                  <Rocket size={11} strokeWidth={2.4} />
                                </span>
                              )}
                            <div className="flex flex-col min-w-0 h-full flex-1">
                              <strong className="text-[10px] font-bold text-zinc-100 truncate">
                                {entry.kind === "visit" ? entry.client : entry.title}
                              </strong>
                              <span className="text-[9px] text-zinc-400 mt-0.5 truncate">
                                {displayedEntry.time}–{getEntryEndTime(displayedEntry)}
                              </span>
                              {entry.kind === "visit" && (
                                <small className="text-[9px] text-zinc-500 truncate mt-0.5">
                                  {entry.service}
                                </small>
                              )}
                              {entry.kind === "visit" && (
                                <small
                                  className={`text-[9px] font-bold mt-0.5 truncate ${
                                    getVisitDebt(entry) > 0 ? "text-rose-400" : "text-emerald-400"
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
                                  <small className="text-[9px] text-red-300 mt-0.5 truncate">
                                    Пакет {getPackageProgressLabel(packageItem, plannedPosition)}
                                  </small>
                                ) : null;
                              })()}
                              {entry.kind === "visit" && (
                                <b className="mt-auto text-[8px] font-bold text-zinc-500 uppercase tracking-wide bg-zinc-800/40 px-1 py-0.5 rounded-sm self-start">
                                  {["no_show", "cancelled"].includes(entry.status)
                                    ? statusLabels[entry.status]
                                    : ended
                                    ? "Окончен"
                                    : statusLabels[entry.status] || statusLabels.scheduled}
                                </b>
                              )}
                            </div>
                            <div className="nuar-calendar-entry-menu absolute top-1 right-1 opacity-0 hover:opacity-100 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex flex-col gap-1 z-10">
                              <button
                                aria-label="Действия записи"
                                className="grid w-5.5 h-5.5 place-items-center rounded bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                title="Действия"
                                type="button"
                                onClick={() =>
                                  setOpenEntryMenuId((current) =>
                                    current === entry.id ? null : entry.id,
                                  )
                                }
                              >
                                <MoreVertical size={12} />
                              </button>
                              {openEntryMenuId === entry.id && (
                                <div className="absolute right-0 top-6 z-20 grid min-w-[132px] p-1 border border-zinc-800 rounded-lg bg-zinc-950 shadow-xl">
                                  {entry.kind === "visit" && activeVisit && (
                                    <button
                                      aria-label="Напомнить клиенту"
                                      className="flex items-center gap-2 h-7 px-2 text-[10px] text-zinc-350 hover:text-white hover:bg-zinc-900 rounded-md cursor-pointer text-left"
                                      title="Напомнить"
                                      type="button"
                                      onClick={() => onRemind(entry)}
                                    >
                                      <BellRing size={13} />
                                      Напомнить
                                    </button>
                                  )}
                                  {activeVisit && (
                                    <button
                                      aria-label="Отменить визит"
                                      className="flex items-center gap-2 h-7 px-2 text-[10px] text-rose-400 hover:bg-rose-500/10 rounded-md cursor-pointer text-left"
                                      title="Отменить"
                                      type="button"
                                      onClick={() => onStatus(entry, "cancelled")}
                                    >
                                      <Ban size={13} />
                                      Отменить
                                    </button>
                                  )}
                                  <button
                                    aria-label="Редактировать"
                                    className="flex items-center gap-2 h-7 px-2 text-[10px] text-zinc-350 hover:text-white hover:bg-zinc-900 rounded-md cursor-pointer text-left"
                                    title="Редактировать"
                                    type="button"
                                    onClick={() => onEdit(entry)}
                                  >
                                    <Pencil size={13} />
                                    Редактировать
                                  </button>
                                  <button
                                    aria-label="Удалить"
                                    className="flex items-center gap-2 h-7 px-2 text-[10px] text-red-400 hover:bg-red-500/10 rounded-md cursor-pointer text-left"
                                    title="Удалить"
                                    type="button"
                                    onClick={() => onDelete(entry)}
                                  >
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
              <div className="fixed right-6 bottom-6 z-50 grid gap-0.5 min-w-[112px] p-3 border border-zinc-800 rounded-lg bg-zinc-900 text-zinc-250 shadow-2xl pointer-events-none">
                <strong className="text-sm font-bold text-zinc-100">
                  {dragPreview.time}–{dragPreview.endTime}
                </strong>
                <span className="text-[10px] text-zinc-500">{dragPreview.master}</span>
              </div>
            )}
          </DndContext>
        )}

        {showRemindersPanel && (
          <button
            aria-label="Закрыть ленту дня"
            className="fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-xs cursor-pointer block md:hidden"
            type="button"
            onClick={() => setRemindersVisible(false)}
          />
        )}
        {showRemindersPanel && (
          <aside className="nuar-calendar-reminders border border-zinc-800 rounded-xl bg-linear-to-br from-zinc-900/90 to-zinc-950/95 shadow-inner p-4 min-h-0 overflow-y-auto flex flex-col gap-3">
            <section className="nuar-calendar-picker" aria-label="Календарь месяца">
              <header>
                <button
                  aria-label="Предыдущий месяц"
                  type="button"
                  onClick={() => shiftCalendarPanelMonth(-1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="nuar-calendar-picker-title">
                  <div className="nuar-calendar-picker-menu">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCalendarPickerMenu((current) =>
                          current === "month" ? null : "month",
                        )
                      }
                    >
                      {monthNames[calendarPanelMonthIndex]}
                    </button>
                    {openCalendarPickerMenu === "month" ? (
                      <div className="nuar-calendar-picker-popover is-month">
                        {monthNames.map((month, index) => (
                          <button
                            className={index === calendarPanelMonthIndex ? "is-selected" : ""}
                            key={month}
                            type="button"
                            onClick={() => setCalendarPanelPart({month: index})}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="nuar-calendar-picker-menu">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCalendarPickerMenu((current) =>
                          current === "year" ? null : "year",
                        )
                      }
                    >
                      {calendarPanelYear}
                    </button>
                    {openCalendarPickerMenu === "year" ? (
                      <div className="nuar-calendar-picker-popover is-year">
                        {calendarPanelYears.map((year) => (
                          <button
                            className={year === calendarPanelYear ? "is-selected" : ""}
                            key={year}
                            type="button"
                            onClick={() => setCalendarPanelPart({year})}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <button
                  aria-label="Следующий месяц"
                  type="button"
                  onClick={() => shiftCalendarPanelMonth(1)}
                >
                  <ChevronRight size={14} />
                </button>
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
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-zinc-100 text-sm font-bold tracking-tight">Лента дня</h2>
                <p className="text-2xs text-zinc-500 mt-0.5">{toDisplayDate(selectedDate)}</p>
              </div>
              <button
                aria-label="Скрыть ленту дня"
                className="grid w-8 h-8 place-items-center border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 cursor-pointer"
                title="Скрыть ленту дня"
                type="button"
                onClick={() => setRemindersVisible(false)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold">
                <b className="text-zinc-200 font-bold">{visitEntries.length}</b> всего
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold">
                <b className="text-zinc-200 font-bold">{activeVisitEntries.length}</b> активных
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-semibold">
                <b className="text-zinc-200 font-bold">{completedVisitEntries.length}</b> окончено
              </span>
            </div>
            <div className="flex p-0.5 mt-1 rounded-lg bg-zinc-950 border border-zinc-850 w-full">
              <button
                className={`flex-1 py-1 text-2xs font-semibold text-center rounded-md cursor-pointer ${
                  reminderFilter === "active" ? "bg-zinc-850 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
                type="button"
                onClick={() => setReminderFilter("active")}
              >
                Активные
              </button>
              <button
                className={`flex-1 py-1 text-2xs font-semibold text-center rounded-md cursor-pointer ${
                  reminderFilter === "all" ? "bg-zinc-850 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
                type="button"
                onClick={() => setReminderFilter("all")}
              >
                Все
              </button>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {visibleReminderEntries.map((entry) => {
                const activeVisit = isEntryActive(entry, selectedDate, now);

                return (
                  <article
                    className={`nuar-calendar-reminder-card grid grid-cols-[44px_1fr_auto] gap-x-2 gap-y-1 w-full p-3 border rounded-xl bg-zinc-900/30 ${
                      entry.id === nextVisitId ? "is-next border-red-800/50 bg-zinc-900/40" : "border-zinc-850"
                    }`}
                    key={entry.id}
                  >
                    <div className="nuar-calendar-reminder-main">
                      <span className="nuar-calendar-reminder-time">
                        {entry.time}
                      </span>
                      <button
                        className="nuar-calendar-reminder-client"
                        type="button"
                        title="Открыть карточку клиента"
                        onClick={() => setViewedClientEntry(entry)}
                      >
                        {entry.client}
                      </button>
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
                      <button
                        aria-label="Действия визита"
                        type="button"
                        onClick={() =>
                          setOpenReminderMenuId((current) =>
                            current === entry.id ? null : entry.id,
                          )
                        }
                      >
                        <MoreVertical size={14} />
                      </button>
                      {openReminderMenuId === entry.id && (
                        <div className="nuar-calendar-reminder-popover">
                          {activeVisit && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenReminderMenuId(null);
                                onRemind(entry);
                              }}
                            >
                              <MessageSquareText size={13} />
                              Напомнить
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenReminderMenuId(null);
                              onEdit(entry);
                            }}
                          >
                            <Pencil size={13} />
                            Редактировать
                          </button>
                          <button
                            className="is-danger"
                            type="button"
                            onClick={() => {
                              setOpenReminderMenuId(null);
                              onDelete(entry);
                            }}
                          >
                            <Trash2 size={13} />
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {visibleReminderEntries.length === 0 && (
                <p className="text-zinc-500 text-xs text-center py-6">
                  {visitEntries.length === 0 ? "На этот день визитов пока нет." : "Активных визитов больше нет."}
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      {pendingSlot && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-zinc-950/60 backdrop-blur-xs select-none"
          role="presentation"
          onClick={() => setPendingSlot(null)}
        >
          <section
            aria-label="Добавить запись"
            className="nuar-calendar-add-popover grid w-[360px] max-w-full overflow-hidden border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex items-center gap-3.5 h-[68px] px-5 border-b border-zinc-800/60 bg-transparent text-left cursor-pointer hover:bg-zinc-850/40 text-zinc-200"
              onClick={() => {
                onAdd({...pendingSlot, kind: "visit"});
                setPendingSlot(null);
              }}
            >
              <CalendarPlus size={18} className="text-red-400" />
              <span className="grid gap-0.5">
                <strong className="text-sm font-bold text-zinc-100">Новый визит</strong>
                <small className="text-zinc-500 text-xs font-medium">Записать клиента</small>
              </span>
            </button>
            <button
              type="button"
              className="flex items-center gap-3.5 h-[68px] px-5 bg-transparent text-left cursor-pointer hover:bg-zinc-850/40 text-zinc-200"
              onClick={() => {
                onAdd({...pendingSlot, kind: "reserved"});
                setPendingSlot(null);
              }}
            >
              <Ban size={18} className="text-zinc-400" />
              <span className="grid gap-0.5">
                <strong className="text-sm font-bold text-zinc-100">Зарезервировать время</strong>
                <small className="text-zinc-500 text-xs font-medium">Закрыть слот без клиента</small>
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
