import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { pushExpo } from "./http.ts";

export interface Notice {
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function deliverNotification(admin: SupabaseClient, notice: Notice) {
  const { data: profile } = await admin.from("profiles").select("expo_push_token").eq("id", notice.user_id).maybeSingle();
  const { error } = await admin.from("notifications").insert({
    user_id: notice.user_id,
    type: notice.type,
    title: notice.title,
    body: notice.body,
    data: notice.data ?? null,
  });
  if (error) throw new Error(error.message);
  await pushExpo(profile?.expo_push_token, notice.title, notice.body, notice.data ?? {});
}
