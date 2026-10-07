-- Audit integrity: vessel history cannot be deleted, payments cannot over-commit
-- an invoice, purchase-order receipt is one transaction, and issued invoices
-- keep their own line snapshot.

-- ---------------------------------------------------------------------------
-- 1. Vessels
-- ---------------------------------------------------------------------------

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_vessel_id_fkey;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_vessel_id_fkey
  FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE RESTRICT;

INSERT INTO public.permissions (key, module, action, description)
VALUES ('work_orders.execute', 'work_orders', 'execute', 'Update an assigned job and issue parts on it')
ON CONFLICT (key) DO UPDATE SET module = EXCLUDED.module, action = EXCLUDED.action, description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'work_orders.execute'
FROM public.roles r
WHERE r.key = 'technician'
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions rp
USING public.roles r
WHERE rp.role_id = r.id
  AND r.key = 'technician'
  AND rp.permission_key IN ('vessels.view', 'vessels.create', 'vessels.edit', 'vessels.delete');

CREATE OR REPLACE FUNCTION public.guard_vessel_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.service_requests WHERE vessel_id = OLD.id)
       OR EXISTS (
         SELECT 1 FROM public.work_orders wo
         JOIN public.service_requests sr ON sr.id = wo.service_request_id
         WHERE sr.vessel_id = OLD.id
       )
       OR EXISTS (
         SELECT 1 FROM public.invoices i
         JOIN public.service_requests sr ON sr.id = i.service_request_id
         WHERE sr.vessel_id = OLD.id
       )
    THEN
      RAISE EXCEPTION 'This vessel has service history and cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF public.current_role() = 'customer' AND EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN public.service_requests sr ON sr.id = i.service_request_id
    WHERE sr.vessel_id = OLD.id
      AND i.status IS DISTINCT FROM 'cancelled'
  ) THEN
    RAISE EXCEPTION 'This vessel has invoices and can only be changed by staff';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_vessel_write ON public.vessels;
CREATE TRIGGER trigger_guard_vessel_write
BEFORE UPDATE OR DELETE ON public.vessels
FOR EACH ROW EXECUTE FUNCTION public.guard_vessel_write();

DROP POLICY IF EXISTS vessels_select ON public.vessels;
CREATE POLICY vessels_select ON public.vessels FOR SELECT USING (
  customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid()))
  OR (SELECT public.has_permission('vessels.view'))
  OR id IN (
    SELECT sr.vessel_id
    FROM public.service_requests sr
    JOIN public.work_orders wo ON wo.service_request_id = sr.id
    WHERE sr.vessel_id IS NOT NULL
      AND (wo.assigned_to = (SELECT auth.uid()) OR wo.supervisor_id = (SELECT auth.uid()))
  )
);

-- ---------------------------------------------------------------------------
-- 2. Payments reserve pending amounts
-- ---------------------------------------------------------------------------

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS allow_overpayment BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_payment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_total NUMERIC(12,2);
  committed NUMERIC(12,2);
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed') THEN
    RETURN NEW;
  END IF;

  IF NEW.allow_overpayment THEN
    IF auth.uid() IS NULL OR NOT public.has_permission('payments.approve') THEN
      RAISE EXCEPTION 'Only finance can record an overpayment' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT COALESCE(total, 0) INTO invoice_total
  FROM public.invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO committed
  FROM public.payments
  WHERE invoice_id = NEW.invoice_id
    AND status IN ('pending', 'confirmed')
    AND id IS DISTINCT FROM NEW.id;

  IF NOT NEW.allow_overpayment AND committed + NEW.amount > invoice_total + 0.009 THEN
    RAISE EXCEPTION 'Payment of % exceeds the % still available on this invoice',
      NEW.amount, GREATEST(invoice_total - committed, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_payment_capacity ON public.payments;
CREATE TRIGGER trigger_guard_payment_capacity
BEFORE INSERT OR UPDATE OF amount, status, invoice_id, allow_overpayment ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_capacity();

-- ---------------------------------------------------------------------------
-- 3. Atomic purchase-order receipt
-- ---------------------------------------------------------------------------

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_id uuid)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po public.purchase_orders;
  line public.purchase_order_items;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_permission('stock_movements.create')
     OR NOT public.has_permission('purchase_orders.edit') THEN
    RAISE EXCEPTION 'You do not have permission to receive purchase orders' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO po FROM public.purchase_orders WHERE id = p_id FOR UPDATE;
  IF po.id IS NULL THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;
  IF po.status = 'received' THEN
    RETURN po;
  END IF;
  IF po.status NOT IN ('sent', 'acknowledged', 'shipped') THEN
    RAISE EXCEPTION 'Only a sent purchase order can be received';
  END IF;

  FOR line IN
    SELECT * FROM public.purchase_order_items
    WHERE purchase_order_id = po.id
    FOR UPDATE
  LOOP
    IF line.inventory_item_id IS NULL OR line.received_at IS NOT NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.stock_movements (
      inventory_item_id, type, quantity, reason, reference, related_po_id, created_by
    ) VALUES (
      line.inventory_item_id, 'in', line.quantity, 'Purchase order received', po.code, po.id, auth.uid()
    );
    UPDATE public.purchase_order_items SET received_at = now() WHERE id = line.id;
  END LOOP;

  UPDATE public.purchase_orders SET status = 'received' WHERE id = po.id RETURNING * INTO po;
  RETURN po;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Frozen invoice lines
-- ---------------------------------------------------------------------------

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) GENERATED ALWAYS AS ((quantity * unit_price)::numeric(12,2)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_items_select ON public.invoice_items;
CREATE POLICY invoice_items_select ON public.invoice_items
FOR SELECT USING (
  invoice_id IN (SELECT id FROM public.invoices)
);

GRANT SELECT ON public.invoice_items TO authenticated;

INSERT INTO public.invoice_items (invoice_id, inventory_item_id, description, quantity, unit_price)
SELECT i.id, qi.inventory_item_id, qi.description, qi.quantity, qi.unit_price
FROM public.invoices i
JOIN public.quotation_items qi ON qi.quotation_id = i.quotation_id
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_items existing WHERE existing.invoice_id = i.id);

UPDATE public.invoices i
SET discount = q.discount
FROM public.quotations q
WHERE i.quotation_id = q.id
  AND i.discount = 0
  AND q.discount IS NOT NULL
  AND q.discount <> 0;

CREATE OR REPLACE FUNCTION public.issue_invoice_from_quotation(p_quotation_id uuid)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.invoices;
  quote public.quotations;
  customer uuid;
BEGIN
  IF NOT public.has_permission('invoices.approve') THEN
    RAISE EXCEPTION 'You do not have permission to issue invoices' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO quote FROM public.quotations WHERE id = p_quotation_id;
  IF quote.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;
  IF quote.status <> 'accepted' THEN
    RAISE EXCEPTION 'Quotation must be accepted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE quotation_id = p_quotation_id AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Invoice already issued for this quotation';
  END IF;

  SELECT customer_id INTO customer FROM public.service_requests WHERE id = quote.service_request_id;
  INSERT INTO public.invoices (
    quotation_id, service_request_id, customer_id, status, currency,
    subtotal, tax_amount, discount, total, issued_at, due_at, created_by
  ) VALUES (
    quote.id, quote.service_request_id, customer, 'issued', quote.currency,
    quote.subtotal, quote.tax_amount, COALESCE(quote.discount, 0), quote.total,
    now(), now() + interval '14 days', auth.uid()
  )
  RETURNING * INTO result;

  INSERT INTO public.invoice_items (invoice_id, inventory_item_id, description, quantity, unit_price)
  SELECT result.id, qi.inventory_item_id, qi.description, qi.quantity, qi.unit_price
  FROM public.quotation_items qi
  WHERE qi.quotation_id = quote.id;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Parts issue follows the assigned job, not a leftover policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS wop_technician_insert ON public.work_order_parts;
DROP POLICY IF EXISTS wop_assignee_insert ON public.work_order_parts;
CREATE POLICY wop_assignee_insert ON public.work_order_parts
FOR INSERT WITH CHECK (
  requested_by = (SELECT auth.uid())
  AND (SELECT public.has_permission('work_orders.execute'))
  AND work_order_id IN (
    SELECT id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- 6. Service request status steps
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_service_request_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  step text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  -- Quotation triggers move the request as part of a trusted transition.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  step := OLD.status::text || '>' || NEW.status::text;
  IF step <> ALL (ARRAY[
    'request_received>inspection_in_progress',
    'inspection_in_progress>quotation_pending',
    'inspection_in_progress>awaiting_spare_parts',
    'quotation_pending>quotation_sent',
    'quotation_pending>awaiting_approval',
    'quotation_sent>awaiting_approval',
    'awaiting_approval>under_repair',
    'awaiting_approval>awaiting_spare_parts',
    'awaiting_spare_parts>under_repair',
    'under_repair>testing',
    'under_repair>awaiting_spare_parts',
    'under_repair>completed',
    'testing>under_repair',
    'testing>completed'
  ]::text[]) THEN
    RAISE EXCEPTION 'Cannot move a service request from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_service_request_status ON public.service_requests;
CREATE TRIGGER trigger_guard_service_request_status
BEFORE UPDATE OF status ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_service_request_status();

-- ---------------------------------------------------------------------------
-- 7. Directory, reports, and counts without full-table downloads
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assignable_profiles(p_permission text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(ARRAY[
    'work_orders.assign', 'service_requests.assign', 'directory.view', 'users.view'
  ]) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE COALESCE(p.is_active, true)
    AND r.is_active
    AND EXISTS (
      SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_key = p_permission
    )
  ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.assignable_profiles(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assignable_profiles(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.low_stock_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.inventory_items
  WHERE COALESCE(is_active, true)
    AND quantity_on_hand <= reorder_level;
$$;

REVOKE ALL ON FUNCTION public.low_stock_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.low_stock_count() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'open_requests', (SELECT count(*) FROM public.service_requests WHERE status NOT IN ('completed', 'cancelled')),
    'jobs_today', (SELECT count(*) FROM public.work_orders WHERE created_at::date = CURRENT_DATE),
    'open_orders', (SELECT count(*) FROM public.purchase_orders WHERE status NOT IN ('received', 'cancelled')),
    'revenue_mtd', (
      SELECT COALESCE(sum(total), 0)
      FROM public.invoices
      WHERE status = 'paid'
        AND to_char(created_at, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
    ),
    'low_stock', (
      SELECT count(*) FROM public.inventory_items
      WHERE COALESCE(is_active, true) AND quantity_on_hand <= reorder_level
    ),
    'requests_by_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', status, 'value', n)), '[]'::jsonb)
      FROM (
        SELECT status::text AS status, count(*) AS n
        FROM public.service_requests
        GROUP BY status
      ) counts
    ),
    'revenue_trend', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', month, 'value', total) ORDER BY month), '[]'::jsonb)
      FROM (
        SELECT to_char(gs, 'YYYY-MM') AS month,
               COALESCE((
                 SELECT sum(i.total)
                 FROM public.invoices i
                 WHERE i.status = 'paid'
                   AND to_char(i.created_at, 'YYYY-MM') = to_char(gs, 'YYYY-MM')
               ), 0) AS total
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - interval '5 months',
          date_trunc('month', CURRENT_DATE),
          interval '1 month'
        ) AS gs
      ) trend
    )
  );
$$;

REVOKE ALL ON FUNCTION public.dashboard_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_service_counts(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS TABLE(status text, value bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT sr.status::text, count(*)
  FROM public.service_requests sr
  WHERE (p_from IS NULL OR sr.created_at >= p_from)
    AND (p_to IS NULL OR sr.created_at < p_to)
  GROUP BY sr.status;
$$;

CREATE OR REPLACE FUNCTION public.report_invoice_summary(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS TABLE(status text, value bigint, invoiced numeric, collected numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    i.status::text,
    count(*),
    COALESCE(sum(i.total), 0),
    COALESCE(sum(i.amount_paid), 0)
  FROM public.invoices i
  WHERE (p_from IS NULL OR i.created_at >= p_from)
    AND (p_to IS NULL OR i.created_at < p_to)
  GROUP BY i.status;
$$;

CREATE OR REPLACE FUNCTION public.report_technician_load()
RETURNS TABLE(name text, completed bigint, open bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.full_name, 'Unassigned'),
    count(*) FILTER (WHERE wo.status = 'completed'),
    count(*) FILTER (WHERE wo.status IS DISTINCT FROM 'completed' AND wo.status IS DISTINCT FROM 'cancelled')
  FROM public.work_orders wo
  LEFT JOIN public.profiles p ON p.id = wo.assigned_to
  GROUP BY p.full_name
  ORDER BY p.full_name;
$$;

CREATE OR REPLACE FUNCTION public.report_low_stock()
RETURNS TABLE(name text, sku text, quantity_on_hand numeric, reorder_level numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT i.name, i.sku, i.quantity_on_hand, i.reorder_level
  FROM public.inventory_items i
  WHERE COALESCE(i.is_active, true)
    AND i.quantity_on_hand <= i.reorder_level
  ORDER BY i.name;
$$;

CREATE OR REPLACE FUNCTION public.report_feedback_summary(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS TABLE(average numeric, responses bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(avg(f.rating), 0), count(*)
  FROM public.feedback f
  WHERE (p_from IS NULL OR f.created_at >= p_from)
    AND (p_to IS NULL OR f.created_at < p_to);
$$;

REVOKE ALL ON FUNCTION public.report_service_counts(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_invoice_summary(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_technician_load() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_low_stock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_feedback_summary(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_service_counts(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_invoice_summary(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_technician_load() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_low_stock() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_feedback_summary(timestamptz, timestamptz) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Indexes, required parents, and a smaller permission catalog
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_purchase_order_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_media_work_order_id ON public.work_order_media(work_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_status ON public.payments(invoice_id, status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.service_request_status_history WHERE service_request_id IS NULL) THEN
    ALTER TABLE public.service_request_status_history ALTER COLUMN service_request_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quotation_items WHERE quotation_id IS NULL) THEN
    ALTER TABLE public.quotation_items ALTER COLUMN quotation_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id IS NULL) THEN
    ALTER TABLE public.purchase_order_items ALTER COLUMN purchase_order_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.work_order_media WHERE work_order_id IS NULL) THEN
    ALTER TABLE public.work_order_media ALTER COLUMN work_order_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE service_request_id IS NULL) THEN
    ALTER TABLE public.messages ALTER COLUMN service_request_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.feedback WHERE service_request_id IS NULL) THEN
    ALTER TABLE public.feedback ALTER COLUMN service_request_id SET NOT NULL;
  END IF;
END $$;

-- Technicians and supervisors can see the customer contact on jobs they are assigned.
-- These lookups run as the owner so the customer and service-request policies
-- cannot call each other and recurse.
CREATE OR REPLACE FUNCTION public.assigned_job_customer_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sr.customer_id
  FROM public.service_requests sr
  JOIN public.work_orders wo ON wo.service_request_id = sr.id
  WHERE wo.assigned_to = (SELECT auth.uid())
     OR wo.supervisor_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.assigned_job_profile_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.profile_id
  FROM public.customers c
  JOIN public.service_requests sr ON sr.customer_id = c.id
  JOIN public.work_orders wo ON wo.service_request_id = sr.id
  WHERE c.profile_id IS NOT NULL
    AND (
      wo.assigned_to = (SELECT auth.uid())
      OR wo.supervisor_id = (SELECT auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.assigned_job_customer_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assigned_job_profile_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assigned_job_customer_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assigned_job_profile_ids() TO authenticated;

DROP POLICY IF EXISTS customers_assigned_job ON public.customers;
CREATE POLICY customers_assigned_job ON public.customers FOR SELECT USING (
  id IN (SELECT public.assigned_job_customer_ids())
);

DROP POLICY IF EXISTS profiles_job_contact ON public.profiles;
CREATE POLICY profiles_job_contact ON public.profiles FOR SELECT USING (
  id IN (SELECT public.assigned_job_profile_ids())
);

DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated
USING ((SELECT public.current_role()) IS DISTINCT FROM 'customer');

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions FOR SELECT TO authenticated
USING ((SELECT public.current_role()) IS DISTINCT FROM 'customer');
