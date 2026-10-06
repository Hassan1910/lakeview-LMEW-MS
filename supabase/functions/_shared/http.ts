import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  return createClient(url, key);
}

// Runs queries as the caller so RLS and database guards apply to them.
export function userClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  return createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function hasPermission(admin: SupabaseClient, userId: string, key: string) {
  const { data, error } = await admin.rpc("user_has_permission", { p_user: userId, p_key: key });
  if (error) throw error;
  return data === true;
}

export async function requireUser(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return { error: json({ error: "Missing authorization" }, 401) };
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = header.slice("Bearer ".length);
  const client = anon
    ? createClient(url, anon, { global: { headers: { Authorization: header } } })
    : createClient(url, service);
  const { data, error } = await client.auth.getUser(anon ? undefined : token);
  if (error || !data.user) return { error: json({ error: "Invalid session" }, 401) };
  return { user: data.user, token };
}

export function requireServiceRole(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const part = token.split(".")[1];
  if (!part) return json({ error: "Service role required" }, 401);
  try {
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.role !== "service_role") return json({ error: "Service role required" }, 403);
  } catch {
    return json({ error: "Invalid token" }, 401);
  }
  return null;
}

export async function pushExpo(token: string | null | undefined, title: string, body: string, data: Record<string, unknown>) {
  if (!token) return;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const access = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (access) headers.Authorization = `Bearer ${access}`;
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify({ to: token, title, body, data, sound: "default" }),
  });
  if (!response.ok) {
    console.error("Expo push failed", response.status, await response.text());
  }
}
