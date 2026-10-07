# Live security model

`docs/db-schema.json` and `docs/rls-policies.json` describe the original specification. The database that actually runs is `supabase/migrations`, through `20250101000015_audit_fixes.sql`.

## Access

- `profiles.role_id` is the source of truth. `profiles.role` is a text copy.
- Staff policies use `has_permission()`. Customers, technicians, and supervisors also have ownership policies for their own rows.
- Signup always creates a customer. A user cannot change their own role or `is_active`.
- The administrator role implicitly holds every permission.
- Customers cannot read the role or permission catalog.

## Integrity added in the audit migration

- Deleting a vessel is `ON DELETE RESTRICT`, and a trigger refuses the delete when the vessel has a service request, work order, or invoice.
- Technicians do not have vessel create, edit, or delete. They can read a vessel only when it is on a job assigned to them or supervised by them.
- Customers cannot edit a vessel that has a non-cancelled invoice.
- A payment in `pending` or `confirmed` cannot push the committed total above the invoice total. Pending rows count. Only finance (`payments.approve`) may set `allow_overpayment`.
- `receive_purchase_order(uuid)` locks the purchase order, writes stock movements once, and marks the order received. A second call returns the received order.
- `issue_invoice_from_quotation` copies quotation lines into `invoice_items`, including the discount. Invoice PDFs read `invoice_items`.
- Technicians insert `work_order_parts` only on work orders assigned to them, and only if they hold `work_orders.execute`.
- Service request status changes follow a fixed sequence. Quotation triggers may still move a request to awaiting approval or under repair.
- `dashboard_metrics`, `low_stock_count`, and the `report_*` functions aggregate in SQL and run as the caller, so row-level security still applies.
- Payments are refused on draft and cancelled invoices. `amount_paid` is calculated from confirmed payments.
- A supplier can acknowledge or ship a purchase order. Only `receive_purchase_order` can mark it received, and every line must point at an inventory item.
- Accepting a quotation does not move a request out of testing, repair, completed, or cancelled.
- A quotation has at most one invoice that is not cancelled.
- Editing or deleting a stock movement updates quantity on hand. Deleting or reducing an issued part returns the stock.

## Edge functions

- Paystack webhook checks the HMAC signature, then confirms an existing pending payment.
- `requireServiceRole` compares the bearer token to `SUPABASE_SERVICE_ROLE_KEY`. Cron and notification functions must keep `verify_jwt` enabled as well.
- Online customer checkout is Paystack (card or mobile money checkout). It is not an M-Pesa STK push. Offline M-Pesa, cash, and bank receipts stay pending until finance verifies them.
