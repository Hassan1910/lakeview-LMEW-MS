import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, json, pushExpo, requireServiceRole } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = requireServiceRole(req);
  if (denied) return denied;

  try {
    const payload = await req.json();
    const userId = payload.user_id as string | undefined;
    const title = payload.title as string | undefined;
    const type = (payload.type as string | undefined) ?? "system";
    if (!userId || !title) return json({ error: "user_id and title are required" }, 400);

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("expo_push_token").eq("id", userId).maybeSingle();
    if (payload.push_only) {
      await pushExpo(payload.expo_push_token ?? profile?.expo_push_token, title, payload.body ?? "", payload.data ?? {});
      return json({ ok: true, push_only: true });
    }

    const { data: notification, error } = await admin.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body: payload.body ?? null,
      data: payload.data ?? null,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    await pushExpo(payload.expo_push_token ?? profile?.expo_push_token, title, payload.body ?? "", payload.data ?? {});
    return json({ ok: true, notification });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Notification failed" }, 500);
  }
});
