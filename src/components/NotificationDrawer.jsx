import {AnimatePresence, motion} from "framer-motion";
import {
  Bell,
  CakeSlice,
  CalendarDays,
  ChevronDown,
  EyeOff,
  MessageSquareText,
  X,
} from "lucide-react";

export default function NotificationDrawer({
  alertsCount,
  animationsEnabled,
  isOpen,
  alertGroupsOpen,
  activeClientAlertId,
  revenueForecastAlerts,
  packageBalanceAlerts,
  actionableNotificationInbox,
  operationsAlerts,
  todayCalendarAlerts,
  birthdayAlerts,
  inactiveClientAlerts,
  onToggleOpen,
  onToggleGroup,
  onToggleActiveAlert,
  onDismissAlert,
  onUndoNotificationAction,
  onDeleteInboxNotification,
  onOpenAlertPage,
  onRemindCalendarClient,
  onOpenCalendar,
  onOpenClientMessageTemplates,
  onOpenTemplatesForClient,
  onDismissClientAlert,
  onOpenClients,
}) {
  const transition = {duration: animationsEnabled ? 0.18 : 0};

  return (
    <div
      className="page-header-actions"
      onClick={(event) => event.stopPropagation()}>
      <div className="client-alert-control">
        <button
          aria-label="Центр уведомлений"
          className="client-alert-button"
          type="button"
          onClick={onToggleOpen}>
          <Bell size={18} />
          {alertsCount > 0 && <b>{alertsCount}</b>}
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              animate={{opacity: 1, y: 0, scale: 1}}
              className="client-alert-popover"
              exit={{opacity: 0, y: -6, scale: 0.98}}
              initial={{opacity: 0, y: -8, scale: 0.98}}
              transition={transition}>
              <div className="client-alert-heading">
                <div>
                  <h2>Уведомления</h2>
                  <p>Только события, требующие внимания</p>
                </div>
                <strong>{alertsCount}</strong>
              </div>
              <div className="client-alert-list">
                {revenueForecastAlerts.length > 0 && (
                  <div className="client-alert-group">
                    <button
                      className="client-alert-group-toggle"
                      type="button"
                      onClick={() => onToggleGroup("forecast")}>
                      Прогноз дохода <b>{revenueForecastAlerts.length}</b>
                      <ChevronDown
                        className={alertGroupsOpen.forecast ? "open" : ""}
                        size={14}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {alertGroupsOpen.forecast && (
                        <motion.div
                          animate={{height: "auto", opacity: 1}}
                          exit={{height: 0, opacity: 0}}
                          initial={{height: 0, opacity: 0}}>
                          {revenueForecastAlerts.map((alert) => (
                            <div className="client-alert-row" key={alert.alertId}>
                              <div className="client-alert-event">
                                <div>
                                  <strong>{alert.title}</strong>
                                  <span>{alert.message}</span>
                                </div>
                                <button
                                  aria-label="Скрыть уведомление"
                                  type="button"
                                  onClick={() => onDismissAlert(alert.alertId)}>
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {packageBalanceAlerts.length > 0 && (
                  <div className="client-alert-group">
                    <button
                      className="client-alert-group-toggle"
                      type="button"
                      onClick={() => onToggleGroup("packages")}>
                      Заканчиваются пакеты <b>{packageBalanceAlerts.length}</b>
                      <ChevronDown
                        className={alertGroupsOpen.packages ? "open" : ""}
                        size={14}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {alertGroupsOpen.packages && (
                        <motion.div
                          animate={{height: "auto", opacity: 1}}
                          exit={{height: 0, opacity: 0}}
                          initial={{height: 0, opacity: 0}}>
                          {packageBalanceAlerts.map((alert) => (
                            <div className="client-alert-row" key={alert.alertId}>
                              <div className="client-alert-event">
                                <div>
                                  <strong>{alert.title}</strong>
                                  <span>{alert.message}</span>
                                </div>
                                <button
                                  aria-label="Скрыть уведомление"
                                  type="button"
                                  onClick={() => onDismissAlert(alert.alertId)}>
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {actionableNotificationInbox.length > 0 && (
                  <div className="client-alert-group">
                    <button
                      className="client-alert-group-toggle"
                      type="button"
                      onClick={() => onToggleGroup("system")}>
                      Корзина изменений <b>{actionableNotificationInbox.length}</b>
                      <ChevronDown
                        className={alertGroupsOpen.system ? "open" : ""}
                        size={14}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {alertGroupsOpen.system && (
                        <motion.div
                          animate={{height: "auto", opacity: 1}}
                          exit={{height: 0, opacity: 0}}
                          initial={{height: 0, opacity: 0}}
                          transition={transition}>
                          {actionableNotificationInbox.map((notification) => (
                            <div className="client-alert-row" key={notification.id}>
                              <div className="client-alert-event">
                                <div>
                                  <strong>{notification.title}</strong>
                                  <span>{notification.message}</span>
                                </div>
                                {notification.undoAction && (
                                  <button
                                    aria-label="Вернуть изменение"
                                    className="client-alert-undo"
                                    title="Вернуть изменение"
                                    type="button"
                                    onClick={() => onUndoNotificationAction(notification)}>
                                    Вернуть
                                  </button>
                                )}
                                <button
                                  aria-label="Убрать событие"
                                  title="Убрать"
                                  type="button"
                                  onClick={() => onDeleteInboxNotification(notification.id)}>
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {operationsAlerts.length > 0 && (
                  <div className="client-alert-group">
                    <button
                      className="client-alert-group-toggle"
                      type="button"
                      onClick={() => onToggleGroup("operations")}>
                      Задачи и склад <b>{operationsAlerts.length}</b>
                      <ChevronDown
                        className={alertGroupsOpen.operations ? "open" : ""}
                        size={14}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {alertGroupsOpen.operations && (
                        <motion.div
                          animate={{height: "auto", opacity: 1}}
                          exit={{height: 0, opacity: 0}}
                          initial={{height: 0, opacity: 0}}
                          transition={transition}>
                          {operationsAlerts.map((alert) => (
                            <div className="client-alert-row" key={alert.alertId}>
                              <button
                                className="client-alert-summary"
                                type="button"
                                onClick={() => onOpenAlertPage(alert.page)}>
                                <div>
                                  <strong>{alert.title}</strong>
                                  <span>{alert.message}</span>
                                </div>
                                <b>Открыть</b>
                              </button>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {todayCalendarAlerts.length > 0 && (
                  <div className="client-alert-group">
                    <button
                      className="client-alert-group-toggle"
                      type="button"
                      onClick={() => onToggleGroup("calendar")}>
                      Ближайшие визиты <b>{todayCalendarAlerts.length}</b>
                      <ChevronDown
                        className={alertGroupsOpen.calendar ? "open" : ""}
                        size={14}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {alertGroupsOpen.calendar && (
                        <motion.div
                          animate={{height: "auto", opacity: 1}}
                          exit={{height: 0, opacity: 0}}
                          initial={{height: 0, opacity: 0}}
                          transition={transition}>
                          {todayCalendarAlerts.map((entry) => (
                            <div className="client-alert-row" key={entry.alertId}>
                              <button
                                className="client-alert-summary"
                                type="button"
                                onClick={() => onToggleActiveAlert(entry.alertId)}>
                                <div>
                                  <strong>
                                    {entry.time} · {entry.client}
                                  </strong>
                                  <span>
                                    {entry.service} · {entry.master}
                                  </span>
                                </div>
                                <b>Сегодня</b>
                              </button>
                              {activeClientAlertId === entry.alertId && (
                                <div className="client-alert-actions">
                                  <button
                                    type="button"
                                    onClick={() => onRemindCalendarClient(entry)}>
                                    <MessageSquareText size={14} />
                                    Написать
                                  </button>
                                  <button type="button" onClick={onOpenCalendar}>
                                    <CalendarDays size={14} />
                                    Календарь
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDismissClientAlert(entry.alertId)}>
                                    <EyeOff size={14} />
                                    Скрыть
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {birthdayAlerts.length > 0 && (
                  <div className="client-alert-group">
                    <button
                      className="client-alert-group-toggle"
                      type="button"
                      onClick={() => onToggleGroup("birthdays")}>
                      Дни рождения <b>{birthdayAlerts.length}</b>
                      <ChevronDown
                        className={alertGroupsOpen.birthdays ? "open" : ""}
                        size={14}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {alertGroupsOpen.birthdays && (
                        <motion.div
                          animate={{height: "auto", opacity: 1}}
                          exit={{height: 0, opacity: 0}}
                          initial={{height: 0, opacity: 0}}
                          transition={transition}>
                          {birthdayAlerts.map((client) => (
                            <div className="client-alert-row" key={client.alertId}>
                              <button
                                className="client-alert-summary"
                                type="button"
                                onClick={() => onToggleActiveAlert(client.alertId)}>
                                <div>
                                  <strong>{client.name}</strong>
                                  <span>
                                    {client.birthdayInfo.date} · поздравить клиента
                                  </span>
                                </div>
                                <b>{client.birthdayInfo.label}</b>
                              </button>
                              {activeClientAlertId === client.alertId && (
                                <div className="client-alert-actions">
                                  <button
                                    type="button"
                                    onClick={() => onOpenClientMessageTemplates(client)}>
                                    <CakeSlice size={14} />
                                    Написать
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDismissClientAlert(client.alertId)}>
                                    <EyeOff size={14} />
                                    Скрыть
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {inactiveClientAlerts.length > 0 && (
                  <div className="client-alert-group">
                    <button
                      className="client-alert-group-toggle"
                      type="button"
                      onClick={() => onToggleGroup("inactive")}>
                      Давно не были <b>{inactiveClientAlerts.length}</b>
                      <ChevronDown
                        className={alertGroupsOpen.inactive ? "open" : ""}
                        size={14}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {alertGroupsOpen.inactive && (
                        <motion.div
                          animate={{height: "auto", opacity: 1}}
                          exit={{height: 0, opacity: 0}}
                          initial={{height: 0, opacity: 0}}
                          transition={transition}>
                          {inactiveClientAlerts.map((client) => (
                            <div
                              className={`client-alert-row ${
                                activeClientAlertId === client.alertId ? "active" : ""
                              }`}
                              key={client.alertId}>
                              <button
                                className="client-alert-summary"
                                type="button"
                                onClick={() => onToggleActiveAlert(client.alertId)}>
                                <div>
                                  <strong>{client.name}</strong>
                                  <span>{client.phone || "Телефон не указан"}</span>
                                </div>
                                <b>
                                  {client.daysAbsent === null
                                    ? "Нет визитов"
                                    : `${client.daysAbsent} дн.`}
                                </b>
                              </button>
                              {activeClientAlertId === client.alertId && (
                                <div className="client-alert-actions">
                                  <button
                                    type="button"
                                    onClick={() => onOpenTemplatesForClient(client)}>
                                    <MessageSquareText size={14} />
                                    Написать
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDismissClientAlert(client.alertId)}>
                                    <EyeOff size={14} />
                                    Скрыть
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          <button
                            className="secondary-button client-alert-category-action"
                            type="button"
                            onClick={onOpenClients}>
                            Открыть клиентов
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {alertsCount === 0 && (
                  <p className="client-alert-empty">
                    Сейчас нет новых уведомлений.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
