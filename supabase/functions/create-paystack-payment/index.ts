import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, hasPermission, json, requireUser } from "../_shared/http.ts";
import {
  fetchPaystackTransaction,
  MOBILE_PAYSTACK_CANCEL,
  paymentConfirmationPatch,
  paymentFailurePatch,
  planPendingPaystackResume,
  resolvePaystackCallback,
  settlePaystackCharge,
  storedAuthorizationUrl,
  type PaystackLookup,
} from "../_shared/paystack.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const invoiceId = body.invoice_id as string | undefined;
    const email = body.email as string | undefined;
    if (!invoiceId || !email) return json({ error: "invoice_id and email are required" }, 400);

    const callback = resolvePaystackCallback(body.callback_url, Deno.env.get("PAYSTACK_CALLBACK_URL"));
    if (!callback.ok) return json({ error: callback.error }, 400);

    const admin = adminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("is_active, email")
      .eq("id", auth.user.id)
      .single();
    if (!profile?.is_active) return json({ error: "Account disabled" }, 403);

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select("id, customer_id, balance, status, code")
      .eq("id", invoiceId)
      .single();
    if (invoiceError || !invoice) return json({ error: "Invoice not found" }, 404);
    if (!["issued", "partially_paid", "overdue"].includes(invoice.status)) {
      return json({ error: "Invoice is not payable" }, 400);
    }

    const amount = Number(invoice.balance);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Invoice has no balance due" }, 400);

    const { data: customer } = await admin
      .from("customers")
      .select("profile_id")
      .eq("id", invoice.customer_id)
      .single();
    if (customer?.profile_id !== auth.user.id && !(await hasPermission(admin, auth.user.id, "payments.create"))) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: pendingRows, error: pendingError } = await admin
      .from("payments")
      .select("id, status, invoice_id, amount, reference, raw_payload")
      .eq("invoice_id", invoice.id)
      .eq("method", "paystack")
      .eq("status", "pending")
      .limit(1);
    if (pendingError) return json({ error: pendingError.message }, 500);

    const pending = pendingRows?.[0];
    if (pending) {
      const releasePending = async (payload: unknown, outcome: "failed" | "cancelled" = "failed") => {
        const { error } = await admin.from("payments").update(paymentFailurePatch(payload, outcome)).eq("id", pending.id).eq("status", "pending");
        return error;
      };

      if (!pending.reference) {
        const error = await releasePending({ verify: "Pending Paystack row had no reference" });
        if (error) return json({ error: error.message }, 500);
      } else {
        const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
        if (!secret) return json({ error: "PAYSTACK_SECRET_KEY is not configured" }, 500);
        const checked = await fetchPaystackTransaction(pending.reference, secret);
        const authorizationUrl = storedAuthorizationUrl(pending.raw_payload);
        const lookup: PaystackLookup = !checked.reachable || (!checked.transaction && !checked.missing)
          ? { kind: "unreachable" }
          : !checked.transaction
            ? { kind: "missing" }
            : { kind: "found", status: checked.transaction.status };
        const plan = planPendingPaystackResume({
          pendingAmount: Number(pending.amount),
          invoiceBalance: amount,
          hasCheckoutUrl: Boolean(authorizationUrl),
          lookup,
        });

        if (plan.action === "stop") return json({ error: plan.error }, 409);

        if (plan.action === "resume") {
          if (authorizationUrl) {
            return json({
              status: "pending",
              resumed: true,
              processing: lookup.kind === "found",
              authorization_url: authorizationUrl,
              reference: pending.reference,
              amount: pending.amount,
            });
          }
          return json({ error: checked.reachable ? (checked.message ?? "This payment is still open.") : checked.message }, checked.reachable ? 409 : 503);
        }

        if (plan.action === "settle" && checked.transaction) {
          const settled = settlePaystackCharge(pending, checked.transaction);
          if (settled.outcome === "error") return json({ error: settled.error }, settled.status);
          if (settled.outcome === "confirmed") {
            if (!settled.duplicate) {
              const { error } = await admin.from("payments").update(paymentConfirmationPatch(checked.transaction)).eq("id", pending.id).in("status", ["pending", "failed", "cancelled"]);
              if (error) return json({ error: error.message }, 500);
            }
            return json({
              status: "confirmed",
              reference: pending.reference,
              amount: pending.amount,
              invoice_id: invoice.id,
            });
          }
          if (settled.outcome === "processing") {
            return json({ error: "A payment for the previous balance is still processing." }, 409);
          }
          if (settled.change && (settled.outcome === "failed" || settled.outcome === "cancelled")) {
            const error = await releasePending(checked.transaction, settled.outcome);
            if (error) return json({ error: error.message }, 500);
          }
        } else if (plan.action === "release") {
          const error = await releasePending(checked.transaction ?? { verify: checked.message ?? "Transaction not found" });
          if (error) return json({ error: error.message }, 500);
        }
      }
    }

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) return json({ error: "PAYSTACK_SECRET_KEY is not configured" }, 500);

    const reference = `LMEW-${(invoice.code ?? invoice.id).toString().slice(0, 24)}-${crypto.randomUUID().slice(0, 8)}`;
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: "KES",
        reference,
        callback_url: callback.callback,
        channels: ["card", "mobile_money", "bank", "bank_transfer"],
        metadata: {
          invoice_id: invoice.id,
          profile_id: customer?.profile_id ?? null,
          cancel_action: `${MOBILE_PAYSTACK_CANCEL}?reference=${encodeURIComponent(reference)}`,
        },
      }),
    });
    const paystackData = await paystackRes.json();
    if (!paystackRes.ok || !paystackData.status) {
      return json({ error: paystackData.message || "Paystack initialization failed" }, 400);
    }

    const { error: insertError } = await admin.from("payments").insert({
      invoice_id: invoice.id,
      amount,
      currency: "KES",
      method: "paystack",
      status: "pending",
      reference: paystackData.data.reference,
      recorded_by: auth.user.id,
      raw_payload: { initialize: paystackData.data },
    });
    if (insertError) return json({ error: insertError.message }, 500);

    return json({
      status: "pending",
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference,
      amount,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Payment init failed" }, 500);
  }
});
