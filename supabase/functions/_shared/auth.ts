import {createUserClient} from "./supabaseAdmin.ts";

export const requireUser = async (request: Request) => {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new Response(JSON.stringify({error: "Missing authorization header"}), {
      status: 401,
    });
  }

  const supabase = createUserClient(authHeader);
  const {data, error} = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Response(JSON.stringify({error: "Unauthorized"}), {status: 401});
  }

  return {supabase, user: data.user, authHeader};
};
