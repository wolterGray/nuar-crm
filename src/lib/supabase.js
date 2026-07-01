import {createClient} from "@supabase/supabase-js";
import {
  mockCalendar,
  mockClients,
  mockEmployees,
  mockServices,
  mockStatistics,
  mockToday,
} from "../mocks/mockData.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isProduction = import.meta.env.PROD;
const useMock =
  !isProduction &&
  (import.meta.env.VITE_USE_MOCK_DATA !== "false" ||
    localStorage.getItem("mockMode") === "true");

export const isSupabaseConfigured = Boolean(
  (supabaseUrl && supabasePublishableKey) || useMock,
);

const MOCK_USER_ID = "dev-user";
const MOCK_STORAGE_KEY = "nuar-crm.mockSupabase";

const createMockSession = () => ({
  access_token: "mock-access-token",
  provider_token: "",
  user: {
    email: "dev@nuar.local",
    id: MOCK_USER_ID,
  },
});

const loadMockDb = () => {
  const fallback = {
    calendar: mockCalendar,
    clients: mockClients,
    crm_snapshots: [],
    employees: mockEmployees,
    services: mockServices,
    site_booking_requests: [],
    site_content: [
      {
        data: {},
        id: "main",
        updated_at: new Date().toISOString(),
      },
    ],
    statistics: [mockStatistics],
    today: mockToday,
  };

  if (isProduction) {
    return fallback;
  }

  try {
    const stored = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || "{}");
    return {...fallback, ...stored};
  } catch {
    return fallback;
  }
};

const saveMockDb = (db) => {
  if (isProduction) {
    return;
  }

  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
};

function createMockQuery(table, db) {
  const sourceRows = Array.isArray(db[table]) ? [...db[table]] : [];
  let rows = [...sourceRows];
  let mutation = null;
  let singleMode = false;
  let maybeSingleMode = false;
  let limitCount = null;

  const execute = () => {
    if (mutation?.type === "upsert") {
      const items = Array.isArray(mutation.payload)
        ? mutation.payload
        : [mutation.payload];

      items.forEach((item) => {
        const key = item.id ? "id" : item.user_id ? "user_id" : null;
        const index =
          key === null
            ? -1
            : rows.findIndex((row) => String(row[key]) === String(item[key]));

        if (index >= 0) {
          rows[index] = {...rows[index], ...item};
        } else {
          rows.push({...item, id: item.id ?? crypto.randomUUID()});
        }
      });

      db[table] = rows;
      saveMockDb(db);
    }

    if (mutation?.type === "update") {
      const selectedIds = new Set(rows.map((row) => row.id));
      rows = rows.map((row) => ({...row, ...mutation.payload}));
      db[table] = sourceRows.map((row) =>
        selectedIds.has(row.id) ? {...row, ...mutation.payload} : row,
      );
      saveMockDb(db);
    }

    const dataRows = limitCount === null ? rows : rows.slice(0, limitCount);
    const data = singleMode || maybeSingleMode ? (dataRows[0] ?? null) : dataRows;

    return Promise.resolve({data, error: null});
  };

  const query = {
    eq(column, value) {
      rows = rows.filter((row) => String(row[column]) === String(value));
      return query;
    },
    limit(count) {
      limitCount = count;
      return query;
    },
    maybeSingle() {
      maybeSingleMode = true;
      return execute();
    },
    order(column, {ascending = true} = {}) {
      rows = [...rows].sort((left, right) => {
        const leftValue = left[column] ?? "";
        const rightValue = right[column] ?? "";
        return ascending
          ? String(leftValue).localeCompare(String(rightValue))
          : String(rightValue).localeCompare(String(leftValue));
      });
      return query;
    },
    select() {
      return query;
    },
    single() {
      singleMode = true;
      return execute();
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    update(payload) {
      mutation = {payload, type: "update"};
      return query;
    },
    upsert(payload) {
      mutation = {payload, type: "upsert"};
      return query;
    },
  };

  return query;
}

function createMockSupabase() {
  const db = loadMockDb();
  let session = createMockSession();
  const listeners = new Set();

  const notify = (event) => {
    listeners.forEach((listener) => listener(event, session));
  };

  return {
    auth: {
      getSession: async () => ({data: {session}, error: null}),
      onAuthStateChange: (listener) => {
        listeners.add(listener);
        return {
          data: {
            subscription: {
              unsubscribe: () => listeners.delete(listener),
            },
          },
        };
      },
      resetPasswordForEmail: async () => ({data: {}, error: null}),
      signInWithOAuth: async () => {
        session = createMockSession();
        notify("SIGNED_IN");
        return {data: {session}, error: null};
      },
      signInWithPassword: async () => {
        session = createMockSession();
        notify("SIGNED_IN");
        return {data: {session}, error: null};
      },
      signOut: async () => {
        session = null;
        notify("SIGNED_OUT");
        return {error: null};
      },
      updateUser: async () => ({data: {user: session?.user ?? null}, error: null}),
    },
    functions: {
      invoke: async (name, {body} = {}) => {
        const action = body?.action ?? "status";

        if (action === "status") {
          return {
            data: {
              configured: false,
              lastRunAt: "",
              previewMessage: "",
              telegramChatIdConfigured: false,
              telegramConfigured: false,
              telegramTokenConfigured: false,
              whatsappConfigured: false,
            },
            error: null,
          };
        }

        if (action === "preview") {
          return {
            data: {
              items: [],
              message: `[mock] ${name} preview`,
              total: 0,
            },
            error: null,
          };
        }

        return {
          data: {
            ok: true,
            processed: 0,
            results: {
              telegram: {ok: false, error: "Mock mode"},
              whatsapp: {ok: false, error: "Mock mode"},
            },
          },
          error: null,
        };
      },
    },
    from: (table) => createMockQuery(table, db),
  };
}

let supabase = null;
if (isSupabaseConfigured && !useMock) {
  supabase = createClient(supabaseUrl, supabasePublishableKey);
} else if (useMock) {
  supabase = createMockSupabase();
}

export { supabase };
