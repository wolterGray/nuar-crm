require('dotenv').config();

const API_URL = String(process.env.RESEED_API_URL || 'https://api.nuarr.pl').replace(/\/$/, '');
const SEED_NAME = 'final-weekly-plan';

const getWeekStart = (date) => {
  const value = new Date(`${date}T12:00:00.000Z`);
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 1 - weekday);
  return value.toISOString().slice(0, 10);
};

const request = async (pathname, options = {}) => {
  const response = await fetch(`${API_URL}${pathname}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `${options.method || 'GET'} ${pathname}: ${response.status}`);
  return body.data ?? body;
};

async function main() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  const session = await request('/api/auth/login', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD}),
  });
  if (!session.token || session.user?.role !== 'owner') throw new Error('Production owner authentication failed');

  const headers = {'content-type': 'application/json', authorization: `Bearer ${session.token}`};
  const tasks = await request('/api/tasks', {headers});
  const weekStart = getWeekStart(new Date().toISOString().slice(0, 10));
  const seededTasks = tasks.filter((task) => task.type !== 'note' && task.payload?.seedName === SEED_NAME);

  for (const task of seededTasks) {
    const payload = task.payload ?? {};
    await request(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...task,
        dueDate: weekStart,
        payload: {
          ...payload,
          dueDate: weekStart,
          repeat: {...(payload.repeat ?? {}), startDate: weekStart},
        },
      }),
    });
  }

  const updated = await request('/api/tasks', {headers});
  const verified = updated.filter((task) => task.type !== 'note' && task.payload?.seedName === SEED_NAME);
  const invalid = verified.filter((task) => task.payload?.repeat?.startDate !== weekStart);
  if (verified.length !== seededTasks.length || invalid.length) throw new Error('Verification failed after aligning weekly task dates');
  console.log(JSON.stringify({updated: verified.length, weekStart, preservedOccurrences: verified.reduce((sum, task) => sum + Object.keys(task.payload?.occurrences ?? {}).length, 0)}, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
