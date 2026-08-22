import {useEffect, useMemo, useState} from 'react'
import EmployeePremiumHoursFields from './EmployeePremiumHoursFields'
import {FieldLabel} from './HintIcon.jsx'
import {resolveEmployeeSiteBookingSlotMinutes} from '../utils/calendarBookableSlots.js'
import {getTodayInput} from '../utils/dateHelpers.js'
import {
  getEmployeeBlockedDates,
  getEmployeeWorkingDays,
  WEEKDAY_OPTIONS,
} from '../utils/employeeAvailability.js'
import {fetchPendingSiteBookings} from '../utils/siteBookingApi.js'
import {Button, Checkbox, Field, Input, Select, Textarea} from './ui/index.js'

const toDateRange = (dates = []) => ({
  end: dates.at(-1) ?? '',
  start: dates[0] ?? '',
})

const buildDateRange = (start, end) => {
  if (!start && !end) return []

  const first = new Date(`${start || end}T12:00:00`)
  const last = new Date(`${end || start}T12:00:00`)

  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) {
    return [start || end].filter(Boolean)
  }

  const from = first <= last ? first : last
  const to = first <= last ? last : first
  const dates = []

  for (const current = new Date(from); current <= to; current.setDate(current.getDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10))
  }

  return dates
}

const toCompactDate = (value) => {
  const [year, month, day] = String(value ?? '').split('-')

  return year && month && day ? `${day}.${month}.${year}` : 'дд.мм.гггг'
}

const normalizeText = (value) =>
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

function EmployeeForm({ employee, onSubmit }) {
  const siteBookingSlotMinutes = resolveEmployeeSiteBookingSlotMinutes(employee ?? {});
  const workingDays = getEmployeeWorkingDays(employee ?? {});
  const blockedDates = getEmployeeBlockedDates(employee ?? {});
  const initialVacation = toDateRange(blockedDates);
  const [employeeName, setEmployeeName] = useState(employee?.name ?? '');
  const [bookingEnabled, setBookingEnabled] = useState(employee?.siteVisible !== false);
  const [vacationStart, setVacationStart] = useState(initialVacation.start);
  const [vacationEnd, setVacationEnd] = useState(initialVacation.end);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [bookingLoadError, setBookingLoadError] = useState('');
  const vacationDates = useMemo(
    () => buildDateRange(vacationStart, vacationEnd),
    [vacationEnd, vacationStart],
  );
  const futurePendingBookings = useMemo(() => {
    const today = getTodayInput();
    const name = normalizeText(employeeName || employee?.name);

    if (!name) return [];

    return pendingBookings.filter((booking) => {
      const status = String(booking.status ?? 'pending');
      const date = String(booking.preferred_date ?? booking.preferredDate ?? '');
      const master = normalizeText(booking.preferred_master ?? booking.preferredMaster);

      return status === 'pending' && date >= today && master === name;
    });
  }, [employee?.name, employeeName, pendingBookings]);

  useEffect(() => {
    let cancelled = false;

    fetchPendingSiteBookings()
      .then((requests) => {
        if (!cancelled) setPendingBookings(Array.isArray(requests) ? requests : []);
      })
      .catch((error) => {
        if (!cancelled) setBookingLoadError(error?.message || 'Не удалось загрузить заявки');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="panel employee-form-panel employee-form-sheet-root">
      <h2>{employee ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h2>
      <form className="employee-form" onSubmit={onSubmit}>
        <Field label="Имя">
          <Input
            name="name"
            required
            value={employeeName}
            onChange={(event) => setEmployeeName(event.target.value)}
          />
        </Field>
        <Field label="Роль">
          <Input name="role" defaultValue={employee?.role ?? 'Массажист'} required />
        </Field>
        <Field label="Телефон">
          <Input name="phone" defaultValue={employee?.phone ?? ''} placeholder="+48" />
        </Field>
        <Field label="Комиссия %">
          <Input min="0" max="100" name="commissionRate" type="number" defaultValue={employee?.commissionRate ?? 0} />
        </Field>
        <div className="form-split">
          <Field label="Начало смены">
            <Input name="shiftStart" type="time" defaultValue={employee?.shiftStart ?? '08:00'} />
          </Field>
          <Field label="Конец смены">
            <Input name="shiftEnd" type="time" defaultValue={employee?.shiftEnd ?? '22:00'} />
          </Field>
        </div>
        <label>
          <FieldLabel hint="Шаг времени, который клиент может выбрать в форме записи на сайте. Учитывается вместе со сменой сотрудника.">
            Интервал записи с сайта
          </FieldLabel>
          <Select
            name="siteBookingSlotMinutes"
            defaultValue={String(siteBookingSlotMinutes)}>
            <option value="15">15 минут</option>
            <option value="30">30 минут</option>
            <option value="45">45 минут</option>
            <option value="60">1 час</option>
            <option value="90">1,5 часа</option>
            <option value="120">2 часа</option>
          </Select>
        </label>
        <Field label="Статус">
          <Select name="status" defaultValue={employee?.status ?? 'Активен'}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </Select>
        </Field>
        <label>
          <FieldLabel hint="Как часто обычно закрываем выплаты сотруднику. Еженедельные выплаты можно собирать фильтром «эта неделя».">
            Расчёт выплат
          </FieldLabel>
          <Select
            name="payrollSchedule"
            defaultValue={employee?.payrollSchedule ?? "monthly"}>
            <option value="monthly">Ежемесячно</option>
            <option value="weekly">Еженедельно</option>
            <option value="daily">Ежедневно по визитам</option>
          </Select>
        </label>
        <div className="employee-pricing-panel">
          <h3>Доступность для записи</h3>
          <label className="employee-booking-toggle">
            <input
              checked={bookingEnabled}
              name="siteBookingEnabled"
              type="checkbox"
              onChange={(event) => setBookingEnabled(event.target.checked)}
            />
            <span>
              <strong>Бронирование с сайта</strong>
              <small>
                {bookingEnabled
                  ? 'Мастер виден в форме записи.'
                  : 'Мастер скрыт на сайте, заявки в CRM не удаляются.'}
              </small>
            </span>
          </label>
          {futurePendingBookings.length > 0 ? (
            <div className={`employee-booking-warning${bookingEnabled ? '' : ' is-disabled-booking'}`}>
              <strong>
                {futurePendingBookings.length} будущих заявок с сайта
              </strong>
              <span>
                {bookingEnabled
                  ? 'Если выключить бронирование, эти заявки останутся в памяти и снова будут учитываться после включения.'
                  : 'Бронирование выключено. Эти заявки сохранены и подтянутся обратно после включения мастера на сайте.'}
              </span>
            </div>
          ) : bookingLoadError ? (
            <small className="employee-booking-load-error">{bookingLoadError}</small>
          ) : null}
          <Field label="Рабочие дни">
            <div className="employee-weekdays-row">
              {WEEKDAY_OPTIONS.map((day) => (
                <label className="employee-weekday-toggle" key={day.value}>
                  <Checkbox
                    defaultChecked={workingDays.includes(day.value)}
                    name="workingDaysOfWeek"
                    value={day.value}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field
            description={vacationDates.length ? `${vacationDates.length} закрытых дн.` : 'Оставь пустым, если отпуска нет'}
            label="Отпуск">
            <div className="employee-vacation-range">
              <label>
                С
                <span className="employee-vacation-date-control">
                  <span className="employee-vacation-date-value" aria-hidden="true">
                    {toCompactDate(vacationStart)}
                  </span>
                  <Input
                    aria-label="Начало отпуска"
                    className="employee-vacation-date-native"
                    type="date"
                    value={vacationStart}
                    onChange={(event) => setVacationStart(event.target.value)}
                  />
                </span>
              </label>
              <label>
                По
                <span className="employee-vacation-date-control">
                  <span className="employee-vacation-date-value" aria-hidden="true">
                    {toCompactDate(vacationEnd)}
                  </span>
                  <Input
                    aria-label="Конец отпуска"
                    className="employee-vacation-date-native"
                    type="date"
                    value={vacationEnd}
                    onChange={(event) => setVacationEnd(event.target.value)}
                  />
                </span>
              </label>
              <Button
                className="employee-vacation-clear"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  setVacationStart('');
                  setVacationEnd('');
                }}>
                Очистить
              </Button>
            </div>
            <Textarea
              className="employee-vacation-hidden-dates"
              name="bookingBlockedDates"
              readOnly
              rows={1}
              value={vacationDates.join('\n')}
            />
          </Field>
        </div>
        <EmployeePremiumHoursFields employee={employee} />
        <Button
          className="crm-primary-action employee-form-submit"
          size="lg"
          type="submit"
          variant="primary">
          {employee ? 'Сохранить сотрудника' : 'Добавить сотрудника'}
        </Button>
      </form>
    </section>
  )
}

export default EmployeeForm
