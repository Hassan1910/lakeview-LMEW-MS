import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { adminClient, corsHeaders, hasPermission, json, requireUser, userClient } from "../_shared/http.ts";

type Action = "list" | "create" | "suspend" | "restore" | "remove" | "reset-password" | "set-password";

type Target = { id: string; email: string | null; full_name: string | null; role: string; is_active: boolean | null };

const SUSPEND_DURATION = "876000h";

async function audit(
  admin: SupabaseClient,
  actor: { id: string; email?: string | null },
  action: string,
  target: Target | { id: string },
  after: Record<string, unknown> | null = null,
) {
  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    actor_email: actor.email ?? null,
    action,
    entity: "accounts",
    entity_id: target.id,
    before: "email" in target ? { email: target.email, full_name: target.full_name, role: target.role, is_active: target.is_active } : null,
    after,
  });
}

async function loadTarget(admin: SupabaseClient, id: unknown) {
  if (typeof id !== "string" || !id) return { error: json({ error: "user_id is required" }, 400) };
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: json({ error: error.message }, 500) };
  if (!data) return { error: json({ error: "User not found" }, 404) };
  return { target: data as Target };
}

// Account changes that RLS can see go through the caller's own session, so the profile guard
// decides whether the caller may touch this account and the audit trigger records who did it.
async function setActive(req: Request, target: Target, active: boolean) {
  const { error } = await userClient(req).from("profiles").update({ is_active: active }).eq("id", target.id).select("id").single();
  return error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;

    const { data: actor } = await admin.from("profiles").select("id, email, role, is_active").eq("id", auth.user.id).single();
    if (!actor?.is_active) return json({ error: "Account disabled" }, 403);

    if (action === "list") {
      if (!(await hasPermission(admin, actor.id, "users.view")) && !(await hasPermission(admin, actor.id, "users.manage"))) {
        return json({ error: "Forbidden" }, 403);
      }
      const accounts: Record<string, { last_sign_in_at: string | null; banned_until: string | null; email_confirmed_at: string | null }> = {};
      for (let page = 1; page < 50; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) return json({ error: error.message }, 500);
        for (const user of data.users) {
          accounts[user.id] = {
            last_sign_in_at: user.last_sign_in_at ?? null,
            banned_until: (user as { banned_until?: string | null }).banned_until ?? null,
            email_confirmed_at: user.email_confirmed_at ?? null,
          };
        }
        if (data.users.length < 1000) break;
      }
      return json({ accounts });
    }

    if (!(await hasPermission(admin, actor.id, "users.manage"))) return json({ error: "Forbidden" }, 403);

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const phone = body.phone ? String(body.phone).trim() : null;
      const roleId = body.role_id as string | undefined;
      const password = body.password ? String(body.password) : null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "A valid email is required" }, 400);
      if (!fullName) return json({ error: "Full name is required" }, 400);
      if (!roleId) return json({ error: "role_id is required" }, 400);
      if (password !== null && password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

      const { data: role } = await admin.from("roles").select("id, key, is_active").eq("id", roleId).maybeSingle();
      if (!role?.is_active) return json({ error: "Choose an active role" }, 400);
      const { data: allowed, error: assignError } = await admin.rpc("can_assign_role", { p_actor: actor.id, p_role: roleId });
      if (assignError) return json({ error: assignError.message }, 500);
      if (!allowed) return json({ error: "You cannot assign a role with permissions you do not hold" }, 403);

      const metadata = { full_name: fullName, phone };
      const created = password
        ? await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata })
        : await admin.auth.admin.inviteUserByEmail(email, {
          data: metadata,
          redirectTo: typeof body.redirect_to === "string" ? body.redirect_to : undefined,
        });
      if (created.error || !created.data.user) {
        const message = created.error?.message ?? "Could not create the account";
        return json({ error: message }, /already|registered|exists/i.test(message) ? 409 : 400);
      }
      const userId = created.data.user.id;

      const { data: profile, error: roleError } = await userClient(req)
        .from("profiles")
        .update({ role_id: roleId, full_name: fullName, phone })
        .eq("id", userId)
        .select("id, email, full_name, role, role_id, is_active")
        .single();
      if (roleError) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: roleError.message }, 403);
      }
      await audit(admin, actor, password ? "ACCOUNT_CREATED" : "ACCOUNT_INVITED", { id: userId }, { email, full_name: fullName, role: role.key });
      return json({ profile, invited: !password });
    }

    const loaded = await loadTarget(admin, body.user_id);
    if (loaded.error) return loaded.error;
    const target = loaded.target;
    if (target.id === actor.id) return json({ error: "Use your profile page to manage your own account" }, 400);
    if (target.role === "administrator" && actor.role !== "administrator") {
      return json({ error: "Only an administrator can manage another administrator" }, 403);
    }

    if (action === "suspend" || action === "restore") {
      const active = action === "restore";
      const error = await setActive(req, target, active);
      if (error) return json({ error: error.message }, 403);
      const { error: banError } = await admin.auth.admin.updateUserById(target.id, { ban_duration: active ? "none" : SUSPEND_DURATION });
      if (banError) {
        await admin.from("profiles").update({ is_active: target.is_active }).eq("id", target.id);
        return json({ error: banError.message }, 500);
      }
      await audit(admin, actor, active ? "ACCOUNT_RESTORED" : "ACCOUNT_SUSPENDED", target, { is_active: active });
      return json({ ok: true, is_active: active });
    }

    if (action === "remove") {
      const { data: linked, error: linkError } = await admin.rpc("profile_linked_records", { p_profile: target.id });
      if (linkError) return json({ error: linkError.message }, 500);
      if (Number(linked) > 0) {
        return json({
          error: `This account is linked to ${linked} record(s) such as requests, quotations, or messages. Suspend it instead so that history is kept.`,
          linked_records: linked,
        }, 409);
      }
      if (target.role === "administrator") {
        const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "administrator").eq("is_active", true).neq("id", target.id);
        if (!count) return json({ error: "At least one active administrator must remain" }, 409);
      }
      await audit(admin, actor, "ACCOUNT_REMOVED", target);
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "reset-password") {
      if (!target.email) return json({ error: "This account has no email address" }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(target.email, {
        redirectTo: typeof body.redirect_to === "string" ? body.redirect_to : undefined,
      });
      if (error) return json({ error: error.message }, 400);
      await audit(admin, actor, "PASSWORD_RESET_SENT", target);
      return json({ ok: true });
    }

    if (action === "set-password") {
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      const { error } = await admin.auth.admin.updateUserById(target.id, { password });
      if (error) return json({ error: error.message }, 400);
      await audit(admin, actor, "PASSWORD_SET", target);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "User management failed" }, 500);
  }
});
