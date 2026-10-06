import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, json, requireServiceRole } from "../_shared/http.ts";
import { deliverNotification } from "../_shared/notify.ts";

serve(async (req) => {
  const denied = requireServiceRole(req);
  if (denied) return denied;

  try {
    const admin = adminClient();
    const now = new Date();
    const { data: invoices, error } = await admin
      .from("invoices")
      .select("id, code, customer_id, balance, due_at, status")
      .lt("due_at", now.toISOString())
      .in("status", ["issued", "partially_paid"]);
    if (error) return json({ error: error.message }, 500);

    const overdue = (invoices ?? []).filter((invoice) => Number(invoice.balance) > 0);
    if (overdue.length === 0) return json({ ok: true, marked_overdue: 0 });

    const ids = overdue.map((invoice) => invoice.id);
    const { error: updateError } = await admin.from("invoices").update({ status: "overdue" }).in("id", ids);
    if (updateError) return json({ error: updateError.message }, 500);

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: existing } = await admin.from("notifications").select("data").eq("title", "Invoice overdue").gte("created_at", since.toISOString());
    const already = new Set((existing ?? []).map((row) => (row.data as { invoice_id?: string } | null)?.invoice_id).filter(Boolean));
    const fresh = overdue.filter((invoice) => !already.has(invoice.id));

    const customerIds = [...new Set(fresh.map((invoice) => invoice.customer_id))];
    const { data: customers } = customerIds.length
      ? await admin.from("customers").select("id, profile_id").in("id", customerIds)
      : { data: [] };
    const profileByCustomer = new Map((customers ?? []).map((customer) => [customer.id, customer.profile_id]));
    const { data: finance, error: holdersError } = await admin.rpc("permission_holders", { p_key: "payments.approve", p_include_admin: false });
    if (holdersError) return json({ error: holdersError.message }, 500);

    let notified = 0;
    for (const invoice of fresh) {
      for (const personId of (finance ?? []) as string[]) {
        await deliverNotification(admin, {
          user_id: personId,
          type: "invoice",
          title: "Invoice overdue",
          body: `${invoice.code ?? invoice.id} is overdue. Balance KES ${invoice.balance}.`,
          data: { invoice_id: invoice.id },
        });
        notified += 1;
      }
      const profileId = profileByCustomer.get(invoice.customer_id);
      if (profileId) {
        await deliverNotification(admin, {
          user_id: profileId,
          type: "invoice",
          title: "Invoice overdue",
          body: `${invoice.code ?? "Your invoice"} is overdue. Balance KES ${invoice.balance}.`,
          data: { invoice_id: invoice.id },
        });
        notified += 1;
      }
    }
    return json({ ok: true, marked_overdue: overdue.length, notified });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Overdue check failed" }, 500);
  }
});
