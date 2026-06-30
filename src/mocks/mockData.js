export const mockToday = [
  { id: 1, clientId: 1, serviceId: 1, employeeId: 1, time: "10:00", status: "Запланировано" },
  { id: 2, clientId: 2, serviceId: 2, employeeId: 2, time: "11:30", status: "Запланировано" },
];

export const mockCalendar = [
  { id: 1, date: "2024-07-01", type: "visits", title: "Визит клиента Иван" },
  { id: 2, date: "2024-07-02", type: "visits", title: "Визит клиента Анна" },
];

export const mockClients = [
  { id: 1, name: "Иван Иванов", phone: "+48 123 456 789", email: "ivan@example.com" },
  { id: 2, name: "Анна Смирнова", phone: "+48 987 654 321", email: "anna@example.com" },
];

export const mockEmployees = [
  { id: 1, name: "Мария Петрова", avatar: "https://i.pravatar.cc/40?img=1", status: "Активен" },
  { id: 2, name: "Алексей Кузнецов", avatar: "https://i.pravatar.cc/40?img=2", status: "Активен" },
];

export const mockServices = [
  { id: 1, name: "Стрижка", price: 80, duration: 30 },
  { id: 2, name: "Окрашивание", price: 150, duration: 60 },
];

export const mockStatistics = {
  todayVisits: 12,
  upcomingVisits: 8,
  revenueToday: 960,
  revenueMonth: 23000,
};
