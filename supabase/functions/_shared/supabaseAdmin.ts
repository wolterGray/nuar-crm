import {createClient} from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const createAdminClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  return createClient(url, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
};

export const createUserClient = (authHeader: string) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  return createClient(url, anonKey, {
    global: {headers: {Authorization: authHeader}},
    auth: {persistSession: false, autoRefreshToken: false},
  });
};
