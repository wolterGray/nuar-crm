const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_URL = String(process.env.RESEED_API_URL || 'https://api.nuarr.pl').replace(/\/$/, '');
const START_DATE = process.env.RESEED_START_DATE || new Date().toISOString().slice(0, 10);
const SEED_VERSION = 5;

const templates = [
  {
    key: 'weekly-monday-meta-analytics', areaId: 'acquisition', title: '01. Аналитика рекламы Meta и оптимизация таргета',
    note: 'Еженедельный контроль рекламного кабинета Facebook Ads Manager. Проверка стоимости заявки в Варшаве и отключение выгоревших макетов.',
    instructions: '1. Открыть Ads Manager.\n2. Выгрузить затраты и цену за лид (CPL) за прошлые 7 дней.\n3. Если CPL вырос > 20%, отключить дорогой макет и заменить на свежий.',
    checklist: ['Снять метрики прошлых 7 дней (затраты, количество лидов, цена клика)', 'Проверить креативы на выгорание (рост стоимости, падение CTR)', 'Перераспределить бюджет на самые дешевые и рабочие связки'],
    resultFields: [{id: 'weeklyAdSpend', label: 'Общие затраты на таргет за неделю', type: 'number', unit: 'PLN'}, {id: 'currentLeadCost', label: 'Текущая стоимость 1 заявки', type: 'number', unit: 'PLN'}],
    weekday: 1, dueTime: '09:30', estimateMinutes: 45,
  },
  {
    key: 'weekly-monday-archive-reels', areaId: 'content', title: '02. Монтаж и публикация Reels из архивов',
    note: 'Сборка роликов из старых видеозаготовок, эстетики студии и отзывов клиентов. Фокус на удержание регулярности алгоритмов Instagram без новых съёмок.',
    instructions: '1. Взять старое красивое видео или скриншот сочного отзыва из CRM.\n2. Наложить трендовый звук и добавить текстовый триггер на экран.\n3. Опубликовать со ссылкой на онлайн-запись в описании.',
    checklist: ["Смонтировать Reels №1 (Формат 'Текст на видео' с напоминанием о записи)", "Смонтировать Reels №2 (Формат 'Социальное доказательство' с плашкой-отзывом)", 'Добавить во все описания призыв к действию (CTA) и ссылку на бронирование'],
    resultFields: [{id: 'publishedReels', label: 'Ссылки на опубликованные ролики', type: 'textarea'}],
    weekday: 1, dueTime: '11:30', estimateMinutes: 75,
  },
  {
    key: 'weekly-monday-blogger-barter', areaId: 'acquisition', title: '03. Рассылка предложений блогерам под бартер',
    note: 'Поиск локальных инфлюенсеров (3к–15к подписчиков) с аудиторией в Варшаве и отправка им приглашений на бесплатный массаж к Оле за отметку в сторис.',
    instructions: '1. Найти в Instagram профили по тегам #warszawagirl или геоточкам кафе в центре.\n2. Скопировать готовый польский или русский скрипт из заметок.\n3. Отправить 5 предложений в Директ и зафиксировать ники в CRM.',
    checklist: ['Найти 5-7 новых потенциальных блогеров в Варшаве', 'Отправить 5 скриптов-предложений в Директ', 'Записать ники тех, кому отправил, в базу CRM для контроля'],
    resultFields: [{id: 'sentInvites', label: 'Количество отправленных инвайтов', type: 'number'}, {id: 'bloggerHandles', label: 'Ники блогеров для контроля', type: 'textarea'}],
    weekday: 1, dueTime: '13:30', estimateMinutes: 60,
  },
  {
    key: 'weekly-tuesday-dormant-clients', areaId: 'retention', title: '04. Фильтрация и анализ спящей базы клиентов',
    note: 'Выгрузка списка клиентов, которые были в студии от 3 до 5 недель назад, но не имеют активных записей на будущее.',
    instructions: '1. Зайти в модуль базы клиентов.\n2. Отфильтровать визиты за последние 30 дней.\n3. Исключить тех, у кого есть записи на эту или следующую неделю.',
    checklist: ['Отфильтровать клиентов без активных записей за последний месяц', 'Сегментировать список по услугам (какой массаж делали ранее)', 'Сформировать готовый список для отправки сообщений'],
    resultFields: [{id: 'dormantClients', label: 'Количество спящих клиентов в списке', type: 'number'}],
    weekday: 2, dueTime: '09:30', estimateMinutes: 60,
  },
  {
    key: 'weekly-tuesday-reviews-reactivation', areaId: 'retention', title: '05. Сервисный сбор отзывов и реактивация',
    note: 'Мягкое напоминание о себе спящим клиентам через заботу и сбор обратной связи от вчерашних посетителей.',
    instructions: '1. Написать вчерашним клиентам, спросить о самочувствии.\n2. Написать спящим клиентам по заготовленному шаблону заботы.\n3. Скопировать текстовые отзывы в CRM.',
    checklist: ['Опросить вчерашних клиентов о качестве сервиса и самочувствии', 'Отправить 10-15 сервисных сообщений спящим клиентам', 'Проверить остатки абонементов и сделать пометки Оле на продление'],
    resultFields: [{id: 'sentMessages', label: 'Количество отправленных сообщений', type: 'number'}, {id: 'responsesAndBookings', label: 'Количество полученных записей/откликов', type: 'number'}],
    weekday: 2, dueTime: '10:30', estimateMinutes: 90,
  },
  {
    key: 'weekly-wednesday-studio-supplies', areaId: 'studio', title: '06. Плановая закупка и контроль расходников студии',
    note: 'Полное обеспечение студии необходимыми материалами на неделю вперёд, чтобы Оля не отвлекалась от работы.',
    instructions: '1. Проверить шкафы и полки в студии.\n2. Зафиксировать нехватку.\n3. Оформить заказ на Allegro/Hurtownia или сделать быстрый выезд.',
    checklist: ['Проверить запасы масел (базовые и арома)', 'Проверить одноразовые простыни, салфетки и шапочки', 'Контроль текстиля: наличие чистых полотенец и халатов', 'Бытовой чек: заказать кофе, чай, сахар и воду для клиентов'],
    resultFields: [{id: 'purchaseCosts', label: 'Сумма затрат на закупки', type: 'number', unit: 'PLN'}, {id: 'nextDeliveryDate', label: 'Дата следующей доставки расходников', type: 'text'}],
    weekday: 3, dueTime: '11:00', estimateMinutes: 90,
  },
  {
    key: 'weekly-thursday-studio-strategy', areaId: 'growth', title: '07. Стратегический анализ студии и масштабирование',
    note: 'Оценка финансовых показателей бизнеса, плотности загрузки мастера и планирование роста прибыли.',
    instructions: '1. Выгрузить отчёт по выручке за прошедшие дни.\n2. Посчитать плотность записи Оли.\n3. Проверить актуальные цены конкурентов в Варшаве.',
    checklist: ['Посчитать процент загрузки Оли (если >80% — нужен второй мастер)', 'Выделить топ-3 самых маржинальных услуг месяца', 'Разработать или обновить оффер для подарочных сертификатов'],
    resultFields: [{id: 'studioOccupancy', label: 'Процент загрузки студии', type: 'number', unit: '%'}, {id: 'nextGrowthPoint', label: 'Главная точка роста на следующую неделю', type: 'text'}],
    weekday: 4, dueTime: '10:00', estimateMinutes: 120,
  },
  {
    key: 'weekly-friday-finance-reconciliation', areaId: 'finance', title: '08. Финансовый отчёт, сверка кассы и Biuro Rachunkowe',
    note: 'Сведение баланса недели, контроль оплат по картам и наличным и упаковка документов для бухгалтера.',
    instructions: '1. Снять рапорт по терминалу (доходы по картам/Blik).\n2. Пересчитать наличные в кассе.\n3. Собрать входящие фактуры за неделю в рабочую папку.',
    checklist: ['Сверить транзакции терминала с данными в CRM', 'Провести инкассацию или сверку наличных в кассе', 'Загрузить все входящие фактуры за неделю для бухгалтера', 'Высчитать процент и выплату зарплаты Оле за неделю'],
    resultFields: [{id: 'weeklyRevenue', label: 'Общая выручка за неделю', type: 'number', unit: 'PLN'}, {id: 'weeklyNetProfit', label: 'Чистая прибыль за вычетом расходов', type: 'number', unit: 'PLN'}],
    weekday: 5, dueTime: '13:00', estimateMinutes: 90,
  },
];

const request = async (pathname, options = {}) => {
  const response = await fetch(`${API_URL}${pathname}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `${options.method || 'GET'} ${pathname}: ${response.status}`);
  return body.data ?? body;
};

const buildTask = (template) => ({
  completed: false,
  description: template.note,
  dueDate: START_DATE,
  note: template.note,
  priority: 'Высокий',
  status: 'active',
  title: template.title,
  type: 'task',
  payload: {
    areaId: template.areaId,
    checklist: template.checklist.map((text, index) => ({done: false, id: `${template.key}-${index + 1}`, text})),
    dueDate: START_DATE,
    dueTime: template.dueTime,
    estimateMinutes: template.estimateMinutes,
    instructions: template.instructions,
    priorityId: 'high',
    repeat: {enabled: true, frequency: 'weekly', startDate: START_DATE, weekdays: [template.weekday]},
    resultFields: template.resultFields,
    resultSource: 'manual',
    seedName: 'final-weekly-plan',
    seedVersion: SEED_VERSION,
    taskKind: 'daily',
    templateKey: template.key,
    templateVersion: SEED_VERSION,
  },
});

async function main() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  const session = await request('/api/auth/login', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD})});
  const token = session.token;
  if (!token || session.user?.role !== 'owner') throw new Error('Production owner authentication failed');
  const headers = {'content-type': 'application/json', authorization: `Bearer ${token}`};
  const tasks = await request('/api/tasks', {headers});
  const backupDir = path.resolve(__dirname, '../backups');
  fs.mkdirSync(backupDir, {recursive: true});
  const backupPath = path.join(backupDir, `tasks-before-weekly-reseed-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(tasks, null, 2)}\n`);

  const operationsTasks = tasks.filter((task) => task.type !== 'note');
  for (const task of operationsTasks) await request(`/api/tasks/${task.id}`, {method: 'DELETE', headers});
  const created = [];
  for (const template of templates) created.push(await request('/api/tasks', {method: 'POST', headers, body: JSON.stringify(buildTask(template))}));

  const finalTasks = await request('/api/tasks', {headers});
  const finalOperations = finalTasks.filter((task) => task.type !== 'note');
  if (finalOperations.length !== templates.length) throw new Error(`Verification failed: expected ${templates.length} tasks, received ${finalOperations.length}`);
  console.log(JSON.stringify({backupPath, deleted: operationsTasks.length, created: created.length, preservedNotes: finalTasks.length - finalOperations.length, titles: finalOperations.map((task) => task.title)}, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
