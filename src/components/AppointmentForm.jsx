import { CalendarPlus } from 'lucide-react'

function AppointmentForm({ services, staff, onAdd }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const service = services.find((item) => item.title === form.get('service'))

    onAdd({
      id: Date.now(),
      client: form.get('client'),
      service: form.get('service'),
      master: form.get('master'),
      status: 'waiting',
      price: service?.price ?? 0,
      room: form.get('room'),
    })

    event.currentTarget.reset()
  }

  return (
    <form className="appointment-form" onSubmit={handleSubmit}>
      <div className="panel-title">
        <CalendarPlus size={18} />
        <h2>Новая запись</h2>
      </div>
      <label>
        Клиент
        <input name="client" placeholder="Имя и фамилия" required />
      </label>
      <div className="form-grid">
        <label>
          Кабинет
          <select name="room" defaultValue="Кабинет 1">
            <option>Кабинет 1</option>
            <option>Кабинет 2</option>
            <option>Кабинет 3</option>
          </select>
        </label>
      </div>
      <label>
        Услуга
        <select name="service" defaultValue={services[0].title}>
          {services.map((service) => (
            <option key={service.id}>{service.title}</option>
          ))}
        </select>
      </label>
      <label>
        Мастер
        <select name="master" defaultValue={staff[0].name}>
          {staff.map((person) => (
            <option key={person.id}>{person.name}</option>
          ))}
        </select>
      </label>
      <button className="primary-action" type="submit">
        Добавить запись
      </button>
    </form>
  )
}

export default AppointmentForm
