import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, hasPermission, json, requireUser } from "../_shared/http.ts";
import {
  fetchPaystackTransaction,
  paymentConfirmationPatch,
  paymentFailurePatch,
  settlePaystackCharge,
  storedAuthorizationUrl,
} from "../_shared/paystack.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    const observe = body.observe === true;
    if (!reference) return json({ error: "reference is required" }, 400);

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("is_active").eq("id", auth.user.id).single();
    if (!profile?.is_active) return json({ error: "Account disabled" }, 403);

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, status, invoice_id, amount, reference, raw_payload")
      .eq("reference", reference)
      .maybeSingle();
    if (paymentError) return json({ error: paymentError.message }, 500);
    if (!payment) return json({ error: "Unknown reference" }, 404);

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select("id, customer_id")
      .eq("id", payment.invoice_id)
      .single();
    if (invoiceError || !invoice) return json({ error: "Invoice not found" }, 404);

    const { data: customer } = await admin.from("customers").select("profile_id").eq("id", invoice.customer_id).single();
    if (customer?.profile_id !== auth.user.id && !(await hasPermission(admin, auth.user.id, "payments.create"))) {
      return json({ error: "Forbidden" }, 403);
    }

    const base = {
      reference: payment.reference,
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      authorization_url: storedAuthorizationUrl(payment.raw_payload),
    };

    if (payment.status === "confirmed") {
      return json({ ...base, outcome: "confirmed", duplicate: true });
    }
    if (payment.status === "refunded") return json({ error: "Payment was refunded" }, 409);

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) return json({ error: "PAYSTACK_SECRET_KEY is not configured" }, 500);

    const checked = await fetchPaystackTransaction(reference, secret);
    if (!checked.reachable) return json({ ...base, outcome: "error", error: checked.message }, 503);
    if (!checked.transaction) return json({ ...base, outcome: "error", error: checked.message ?? "Transaction not found" }, 502);

    const settled = settlePaystackCharge(payment, checked.transaction);
    if (settled.outcome === "error") return json({ ...base, outcome: "error", error: settled.error }, settled.status);
    if (settled.outcome === "processing") return json({ ...base, outcome: "processing" });

    if (settled.outcome === "confirmed") {
      if (!settled.duplicate) {
        const { data: updated, error } = await admin
          .from("payments")
          .update(paymentConfirmationPatch(checked.transaction))
          .eq("id", payment.id)
          .in("status", ["pending", "failed", "cancelled"])
          .select("id");
        if (!error && !updated?.length) return json({ error: "Payment can no longer be confirmed" }, 409);
        if (error) return json({ error: error.message }, 500);
      }
      return json({ ...base, outcome: "confirmed", duplicate: settled.duplicate });
    }

    if ((settled.outcome === "failed" || settled.outcome === "cancelled") && settled.change && !observe) {
      const { error } = await admin
        .from("payments")
        .update(paymentFailurePatch(checked.transaction, settled.outcome))
        .eq("id", payment.id)
        .eq("status", "pending");
      if (error) return json({ error: error.message }, 500);
    }
    return json({ ...base, outcome: settled.outcome });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Payment verification failed" }, 500);
  }
});
