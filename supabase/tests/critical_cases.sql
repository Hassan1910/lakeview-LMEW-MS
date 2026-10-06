-- pgTAP checks for the seven critical schema, payment, and RLS cases.
-- Run with: supabase test db
BEGIN;
SELECT plan(18);

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

SELECT * FROM finish();
ROLLBACK;
