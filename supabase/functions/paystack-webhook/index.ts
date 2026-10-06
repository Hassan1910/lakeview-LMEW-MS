import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, json } from "../_shared/http.ts";
import { mpesaReceipt, paystackChargeDecision } from "../_shared/paystack.ts";

async function hmacSha512(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("PAYSTACK_WEBHOOK_SECRET");
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();
  if (!secret || !signature) return json({ error: "Webhook signature required" }, 401);

  const expected = await hmacSha512(secret, rawBody);
  if (expected !== signature) return json({ error: "Invalid signature" }, 401);

  try {
    const payload = JSON.parse(rawBody);
    if (payload.event !== "charge.success") return json({ received: true });

    const data = payload.data;
    const reference = data.reference as string | undefined;
    const invoiceId = data.metadata?.invoice_id as string | undefined;
    if (!reference || !invoiceId) return json({ error: "Missing reference or invoice_id" }, 400);

    const admin = adminClient();
    const { data: existing, error: existingError } = await admin
      .from("payments")
      .select("id, status, invoice_id, amount")
      .eq("reference", reference)
      .maybeSingle();
    if (existingError) return json({ error: existingError.message }, 500);

    const decision = paystackChargeDecision(existing, { invoiceId, amountMinor: Number(data.amount) });
    if (!decision.ok) return json({ error: decision.error }, decision.status ?? 400);
    if (decision.duplicate) return json({ received: true, duplicate: true });

    const { error } = await admin.from("payments").update({
      status: "confirmed",
      paid_at: data.paid_at ?? new Date().toISOString(),
      mpesa_receipt: mpesaReceipt(data),
      raw_payload: data,
    }).eq("id", existing!.id);
    if (error) return json({ error: error.message }, 500);

    return json({ received: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Webhook failed" }, 500);
  }
});
