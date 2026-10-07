-- pgTAP checks for the seven critical schema, payment, and RLS cases.
-- Run with: supabase test db
BEGIN;
SELECT plan(45);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotation_items' AND column_name = 'line_total' AND is_generated = 'ALWAYS'
  ),
  'quotation line totals are generated'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'balance' AND is_generated = 'ALWAYS'
  ),
  'invoice balance is generated'
);

SELECT ok(
  pg_get_functiondef('public.handle_new_user()'::regprocedure) LIKE '%''customer''%',
  'signup forces the customer role'
);

SELECT ok(
  pg_get_functiondef('public.recalc_invoice_balance()'::regprocedure) LIKE '%confirmed%',
  'invoice balance counts confirmed payments'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_decrement_stock_on_work_order_part'),
  'issuing a part writes a stock movement'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_select_own_or_staff'),
  'customers are visible only to the owner or staff'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ic_staff_read'),
  'inventory categories are readable by staff'
);

SELECT ok(
  (SELECT with_check FROM pg_policies WHERE policyname = 'pay_customer_create') LIKE '%pending%',
  'customers can only insert pending payments'
);

SELECT ok(
  pg_get_functiondef('public.guard_technician_work_order_update()'::regprocedure) LIKE '%Technicians may only update%',
  'technicians cannot rewrite assignment columns'
);

SELECT ok(
  pg_get_functiondef('public.recalc_invoice_balance()'::regprocedure) LIKE '%''issued''%',
  'a zero confirmed balance returns the invoice to issued'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'issue_invoice_from_quotation'),
  'finance issues an invoice from an accepted quotation'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_catalog'),
  'catalog search is available to authenticated clients'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.profiles p LEFT JOIN public.roles r ON r.id = p.role_id WHERE r.key IS DISTINCT FROM p.role),
  'every profile role key matches its role_id'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (COALESCE(qual, '') ~ 'current_role\(\)\s*=\s*ANY' OR COALESCE(with_check, '') ~ 'current_role\(\)\s*=\s*ANY')
  ),
  'staff policies check permissions instead of role lists'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.user_has_permission(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.permission_holders(text, boolean)', 'EXECUTE'),
  'permission lookups about other users are server-only'
);

SELECT ok(
  pg_get_functiondef('public.guard_profile_role()'::regprocedure) LIKE '%can_assign_role%',
  'role assignment cannot grant permissions the actor lacks'
);

SELECT ok(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'audit_logs_actor_id_fkey') = 'n',
  'removing an account keeps its audit history'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_audit_role_permissions'),
  'permission changes are audited'
);

SELECT ok(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'service_requests_vessel_id_fkey') = 'r',
  'deleting a vessel cannot cascade into service requests'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.roles r ON r.id = rp.role_id
    WHERE r.key = 'technician'
      AND rp.permission_key IN ('vessels.create', 'vessels.edit', 'vessels.delete')
  ),
  'technicians cannot create, edit, or delete vessels'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_guard_payment_capacity'),
  'pending payments are reserved against the invoice total'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'receive_purchase_order'),
  'purchase orders are received in one function'
);

SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items'),
  'issued invoices keep their own lines'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wop_technician_insert')
  AND EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wop_assignee_insert'),
  'technicians issue parts only on assigned jobs'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.roles r ON r.id = rp.role_id
    WHERE r.key = 'technician' AND rp.permission_key = 'work_orders.execute'
  ),
  'technicians hold the execute permission for assigned jobs'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_guard_service_request_status'),
  'service requests follow a status sequence'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sync_request_status_from_work_orders'),
  'finished jobs move the service request to testing'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'low_stock_count'),
  'low stock is counted in the database'
);

SELECT ok(
  pg_get_functiondef('public.guard_payment_capacity()'::regprocedure) LIKE '%issued invoice%',
  'payments cannot be recorded against a draft or cancelled invoice'
);

SELECT ok(
  pg_get_functiondef('public.guard_supplier_po_update()'::regprocedure) LIKE '%acknowledge%',
  'suppliers can only acknowledge or ship a purchase order'
);

SELECT ok(
  pg_get_functiondef('public.quotation_accept_target(public.service_status, integer, integer)'::regprocedure) LIKE '%quotation_pending%'
  AND pg_get_functiondef('public.apply_quotation_status()'::regprocedure) LIKE '%quotation_accept_target%',
  'accepting a quotation leaves a finished job in testing'
);

SELECT ok(
  pg_get_functiondef('public.guard_invoice_actions()'::regprocedure) LIKE '%calculated from payments%',
  'invoice amount paid is calculated from payments'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'invoices_one_open_per_quotation'
  ),
  'a quotation has at most one open invoice'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sync_stock_movement_change')
  AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_restore_stock_on_work_order_part_delete'),
  'deleting a stock movement or issued part restores inventory'
);

SELECT ok(
  pg_get_functiondef('public.receive_purchase_order(uuid)'::regprocedure) LIKE '%needs an inventory item%',
  'a purchase order is not received until every line is stocked'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_status' AND e.enumlabel = 'cancelled'
  ),
  'payment status includes cancelled'
);

SELECT ok(
  (SELECT with_check FROM pg_policies WHERE policyname = 'pay_customer_create') LIKE '%invoice_pending_total%',
  'a second customer payment reserves pending amounts'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assign_request_technician'),
  'assigning a technician updates the open job'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_request_quotation'),
  'saving a quotation updates the open draft'
);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_customer_record'),
  'customer company and phone save together'
);

SELECT is(
  public.quotation_accept_target('awaiting_approval', 0, 1)::text,
  'testing',
  'accepting a quotation after every job is finished moves the request to testing'
);

SELECT ok(
  public.quotation_accept_target('testing', 0, 1) IS NULL,
  'accepting a quotation does not pull a finished request out of testing'
);

INSERT INTO public.suppliers (name) VALUES ('pgtap supplier');
INSERT INTO public.purchase_orders (supplier_id, status)
SELECT id, 'sent' FROM public.suppliers WHERE name = 'pgtap supplier';
INSERT INTO public.purchase_order_items (purchase_order_id, description, quantity, unit_cost)
SELECT po.id, 'Loose bolt', 2, 10
FROM public.purchase_orders po
JOIN public.suppliers s ON s.id = po.supplier_id
WHERE s.name = 'pgtap supplier';

SELECT is(
  public.purchase_order_receive_problem((
    SELECT po.id FROM public.purchase_orders po
    JOIN public.suppliers s ON s.id = po.supplier_id
    WHERE s.name = 'pgtap supplier'
  )),
  'Every purchase order line needs an inventory item before it can be received',
  'receiving a purchase order with a missing inventory item is refused'
);

INSERT INTO public.inventory_items (sku, name, quantity_on_hand, reorder_level)
VALUES ('pgtap-stock-edit', 'Pgtap bolt', 0, 0);
INSERT INTO public.stock_movements (inventory_item_id, type, quantity, reason)
SELECT id, 'in', 10, 'receipt' FROM public.inventory_items WHERE sku = 'pgtap-stock-edit';
UPDATE public.stock_movements
SET quantity = 4
WHERE inventory_item_id = (SELECT id FROM public.inventory_items WHERE sku = 'pgtap-stock-edit');

SELECT ok(
  (SELECT quantity_on_hand FROM public.inventory_items WHERE sku = 'pgtap-stock-edit') = 4,
  'editing a stock movement updates quantity on hand'
);

DELETE FROM public.stock_movements
WHERE inventory_item_id = (SELECT id FROM public.inventory_items WHERE sku = 'pgtap-stock-edit');

SELECT ok(
  (SELECT quantity_on_hand FROM public.inventory_items WHERE sku = 'pgtap-stock-edit') = 0,
  'deleting a stock movement restores quantity on hand'
);

SELECT * FROM finish();
ROLLBACK;
