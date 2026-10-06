import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, json, requireServiceRole } from "../_shared/http.ts";
import { deliverNotification } from "../_shared/notify.ts";

serve(async (req) => {
  const denied = requireServiceRole(req);
  if (denied) return denied;

  try {
    const admin = adminClient();
    const { data: items, error } = await admin
      .from("inventory_items")
      .select("id, name, sku, quantity_on_hand, reorder_level")
      .eq("is_active", true);
    if (error) return json({ error: error.message }, 500);

    const critical = (items ?? []).filter((item) => Number(item.quantity_on_hand) <= Number(item.reorder_level));
    if (critical.length === 0) return json({ ok: true, critical: 0 });

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: existing } = await admin
      .from("notifications")
      .select("data")
      .eq("type", "low_stock")
      .gte("created_at", since.toISOString());
    const already = new Set((existing ?? []).map((row) => (row.data as { inventory_item_id?: string } | null)?.inventory_item_id).filter(Boolean));
    const fresh = critical.filter((item) => !already.has(item.id));

    const { data: managers, error: holdersError } = await admin.rpc("permission_holders", { p_key: "inventory.edit", p_include_admin: true });
    if (holdersError) return json({ error: holdersError.message }, 500);
    let notified = 0;
    for (const managerId of (managers ?? []) as string[]) {
      for (const item of fresh) {
        await deliverNotification(admin, {
          user_id: managerId,
          type: "low_stock",
          title: `Low stock: ${item.name}`,
          body: `${item.sku} is at ${item.quantity_on_hand}. Reorder level is ${item.reorder_level}.`,
          data: { inventory_item_id: item.id, sku: item.sku },
        });
        notified += 1;
      }
    }
    return json({ ok: true, critical: critical.length, notified });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Low stock check failed" }, 500);
  }
});
