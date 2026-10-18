# NUAR CRM: Notification Center V2

Дата: 18.10.2026.

## Что реализовано

- Единый backend registry категорий `critical`, `action`, `opportunity`, `information`.
- Категория определяется типом и бизнес-условием, а не числовым score.
- Персональный `GET /api/notification-events/counts` считает все доступные события независимо от лимита карточек.
- Счётчик внимания включает только актуальные `critical` и `action` с учётом recipient status и snooze.
- Список сначала получает актуальные события внимания, затем возможности и историю, и только после этого применяет limit.
- Frontend больше не вызывает mutation-generator при polling.
- Возможности группируются существующей агрегацией клиентов и пакетов.
- Drawer использует разделы «Внимание», «Возможности», «История», «Все».
- Dry-run lifecycle определяет устаревшие action/opportunity; информационная история не удаляется.
- Повторное возникновение smart-condition может вернуть ранее resolved событие в `new`.
- Fingerprint переноса включает исходный и конечный слот: повтор одной операции дедуплицируется, отдельный перенос сохраняется.
- Web Push, VAPID, подписки и delivery pipeline не изменены.

## Правила актуальности

| Тип | Категория | Когда перестаёт быть актуальным |
|---|---|---|
| Просроченная задача | Action | Выполнена, архивирована, отменена или срок перенесён |
| Низкий склад | Action | Остаток снова выше минимума |
| Неактивный клиент | Opportunity | Клиент удалён или появился более новый визит |
| Заканчивающийся пакет | Opportunity | Остаток выше порога или пакет закрыт/истёк |
| Сертификат | Opportunity | Сертификат закрыт/истёк/отменён |
| Waitlist | Opportunity | Запись закрыта, выполнена или отменена |
| Создание/перенос/отмена визита | Information | Хранится как история, не входит в красный badge |

## Feature flags и откат

- `VITE_NOTIFICATION_CENTER_V2=false` возвращает frontend к старому локальному badge.
- `NOTIFICATION_LIFECYCLE_V2_WRITE=false` блокирует любые массовые lifecycle-записи.
- При недоступности нового count endpoint frontend автоматически использует прежний расчёт.

## Безопасный rollout

1. Развернуть backend, не включая `NOTIFICATION_LIFECYCLE_V2_WRITE`.
2. Проверить `GET /api/notification-events/counts` под owner.
3. Выполнить `npm run notifications:reconcile` в `backend`: команда работает как dry-run.
4. Сравнить `candidateCount` и `byType` с production-диагностикой.
5. Развернуть frontend с `VITE_NOTIFICATION_CENTER_V2=true`.
6. Проверить badge, вкладки и персональные seen/snooze/resolved на нескольких устройствах.
7. Только после отдельного подтверждения установить `NOTIFICATION_LIFECYCLE_V2_WRITE=true` и выполнить
   `npm run notifications:reconcile -- --commit`.
8. После подтверждённого commit flag можно оставить включённым для lifecycle-фазы существующего notification worker.

## Исторические данные

Ничего не удаляется. Commit меняет только status устаревших action/opportunity на `resolved`, ставит
`resolvedAt` и добавляет `auto_resolve_stale_condition` в `actionHistory`. Реклассификация не создаёт
`NotificationDelivery`, поэтому старые Push повторно не отправляются.

По production snapshot от 18.10.2026 ожидаемый dry-run: 30 кандидатов lifecycle registry
(27 задач без актуального условия, 1 восстановленный склад, 2 отсутствующих клиента). События визитов
не входят в этот commit: они остаются информационной историей и перестают влиять на badge.

## Миграции

Prisma migration не требуется. Категория и актуальность вычисляются backend registry, существующие
таблицы `NotificationEvent`, `NotificationRecipient` и `NotificationDelivery` сохраняются.
