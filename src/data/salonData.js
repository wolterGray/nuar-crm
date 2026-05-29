export const clients = [
  {
    id: 1,
    name: 'Анна Коваленко',
    phone: '+48 731 204 118',
    visits: 12,
    lastVisit: '26 мая',
    favorite: 'Лимфодренаж',
    balance: 0,
    tag: 'VIP',
  },
  {
    id: 2,
    name: 'Мария Новак',
    phone: '+48 602 810 443',
    visits: 5,
    lastVisit: '21 мая',
    favorite: 'Релакс 60',
    balance: 120,
    tag: 'Нужно оплатить',
  },
  {
    id: 3,
    name: 'Олег Сафронов',
    phone: '+48 798 114 903',
    visits: 3,
    lastVisit: '18 мая',
    favorite: 'Спина и шея',
    balance: 0,
    tag: 'Новый курс',
  },
  {
    id: 4,
    name: 'Елена Вишневская',
    phone: '+48 516 770 221',
    visits: 8,
    lastVisit: '14 мая',
    favorite: 'Спортивный',
    balance: 0,
    tag: 'Пакет 5',
  },
]

export const services = [
  { id: 1, title: 'Релакс 60', duration: 60, price: 180, color: 'teal' },
  { id: 2, title: 'Спина и шея', duration: 45, price: 150, color: 'iris' },
  { id: 3, title: 'Лимфодренаж', duration: 75, price: 230, color: 'coral' },
  { id: 4, title: 'Спортивный', duration: 90, price: 270, color: 'olive' },
]

export const staff = [
  { id: 1, name: 'Влада', role: 'массажист', load: 78 },
  { id: 2, name: 'Ирина', role: 'массажист', load: 62 },
  { id: 3, name: 'Максим', role: 'реабилитолог', load: 84 },
]

export const initialAppointments = [
  {
    id: 101,
    client: 'Анна Коваленко',
    service: 'Лимфодренаж',
    master: 'Влада',
    status: 'confirmed',
    price: 230,
    room: 'Кабинет 1',
  },
  {
    id: 102,
    client: 'Олег Сафронов',
    service: 'Спина и шея',
    master: 'Максим',
    status: 'waiting',
    price: 150,
    room: 'Кабинет 2',
  },
  {
    id: 103,
    client: 'Мария Новак',
    service: 'Релакс 60',
    master: 'Ирина',
    status: 'confirmed',
    price: 180,
    room: 'Кабинет 1',
  },
  {
    id: 104,
    client: 'Елена Вишневская',
    service: 'Спортивный',
    master: 'Максим',
    status: 'done',
    price: 270,
    room: 'Кабинет 2',
  },
]
