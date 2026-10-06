import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, corsHeaders, hasPermission, json, requireUser } from "../_shared/http.ts";

const REPORT_PERMISSIONS = [
  "service_requests.view_reports",
  "invoices.view_reports",
  "inventory.view_reports",
];

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines: string[]) {
  const commands = ["BT", "/F1 11 Tf", "48 800 Td", "14 TL"];
  lines.slice(0, 48).forEach((line, index) => {
    const text = `(${pdfEscape(line.slice(0, 110))}) Tj`;
    commands.push(index === 0 ? text : `T* ${text}`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(body);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
    const body = await req.json();
    const type = body.type as "quotation" | "invoice" | "report";
    const id = body.id as string;
    if (!type || !id) return json({ error: "type and id are required" }, 400);

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("is_active").eq("id", auth.user.id).single();
    if (!profile?.is_active) return json({ error: "Account disabled" }, 403);

    const { data: company } = await admin.from("company_info").select("name, phone, email, address").eq("id", 1).maybeSingle();
    const lines = [
      company?.name ?? "Lakeview Marine Engineering Works",
      "Reliable Marine Engineering on Lake Victoria",
      [company?.phone, company?.email, company?.address].filter(Boolean).join(" · "),
      `${type.toUpperCase()}`,
      `Generated ${new Date().toISOString().slice(0, 10)}`,
      "",
    ];

    let bucket = "reports";
    let path = `${auth.user.id}/${id}.pdf`;

    if (type === "quotation") {
      const { data, error } = await admin.from("quotations").select("code, currency, subtotal, tax_amount, discount, total, status, service_request_id").eq("id", id).single();
      if (error || !data) return json({ error: "Quotation not found" }, 404);
      const { data: request } = await admin.from("service_requests").select("customer_id").eq("id", data.service_request_id).single();
      const { data: customer } = await admin.from("customers").select("profile_id").eq("id", request?.customer_id ?? "").maybeSingle();
      const allowed = customer?.profile_id === auth.user.id || await hasPermission(admin, auth.user.id, "quotations.print");
      if (!allowed) return json({ error: "Forbidden" }, 403);
      const { data: items } = await admin.from("quotation_items").select("description, quantity, unit_price, line_total").eq("quotation_id", id);
      lines.push(`Code: ${data.code ?? id}`, `Status: ${data.status}`, `Subtotal: ${data.subtotal} ${data.currency}`, `Tax: ${data.tax_amount}`, `Discount: ${data.discount}`, `Total: ${data.total} ${data.currency}`, "");
      for (const item of items ?? []) lines.push(`${item.description}  ${item.quantity} x ${item.unit_price} = ${item.line_total}`);
      bucket = "quotation-pdfs";
      path = `${id}/${data.code ?? id}.pdf`;
    } else if (type === "invoice") {
      const { data, error } = await admin.from("invoices").select("code, currency, subtotal, tax_amount, total, amount_paid, balance, status, customer_id, quotation_id").eq("id", id).single();
      if (error || !data) return json({ error: "Invoice not found" }, 404);
      const { data: customer } = await admin.from("customers").select("profile_id").eq("id", data.customer_id).single();
      const allowed = customer?.profile_id === auth.user.id || await hasPermission(admin, auth.user.id, "invoices.print");
      if (!allowed) return json({ error: "Forbidden" }, 403);
      lines.push(`Code: ${data.code ?? id}`, `Status: ${data.status}`, `Subtotal: ${data.subtotal}`, `Tax: ${data.tax_amount}`, `Total: ${data.total} ${data.currency}`, `Paid: ${data.amount_paid}`, `Balance: ${data.balance}`, "");
      if (data.quotation_id) {
        const { data: items } = await admin.from("quotation_items").select("description, quantity, unit_price, line_total").eq("quotation_id", data.quotation_id);
        for (const item of items ?? []) lines.push(`${item.description}  ${item.quantity} x ${item.unit_price} = ${item.line_total}`);
      }
      bucket = "invoice-pdfs";
      path = `${id}/${data.code ?? id}.pdf`;
    } else {
      const checks = await Promise.all(REPORT_PERMISSIONS.map((key) => hasPermission(admin, auth.user.id, key)));
      if (!checks.some(Boolean)) return json({ error: "Forbidden" }, 403);
      const rows = Array.isArray(body.rows) ? body.rows as string[] : [];
      lines.push(String(body.title ?? "Report"), ...rows.map(String));
    }

    const bytes = buildPdf(lines.filter((line) => line !== undefined));
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) return json({ error: uploadError.message }, 500);
    const { data: signed, error: signError } = await admin.storage.from(bucket).createSignedUrl(path, 3600);
    if (signError || !signed?.signedUrl) return json({ error: signError?.message ?? "Could not sign URL" }, 500);
    return json({ signed_url: signed.signedUrl });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "PDF failed" }, 500);
  }
});
