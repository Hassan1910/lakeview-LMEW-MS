-- One open job per assignment, one draft quotation per request, and one
-- customer save. Cancelled checkouts are not gateway failures. Pending
-- payments count against what a customer can still record.

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cancelled';

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invoice_pending_total(p_invoice uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.payments
  WHERE invoice_id = p_invoice AND status = 'pending';
$$;

DROP POLICY IF EXISTS pay_customer_create ON public.payments;
CREATE POLICY pay_customer_create ON public.payments
FOR INSERT WITH CHECK (
  status = 'pending'
  AND amount > 0
  AND invoice_id IN (
    SELECT i.id FROM public.invoices i
    WHERE i.customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid()))
      AND i.status IN ('issued', 'partially_paid', 'overdue')
      AND i.balance >= payments.amount + public.invoice_pending_total(i.id)
  )
);

CREATE OR REPLACE FUNCTION public.guard_payment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invoice_total NUMERIC(12,2);
  invoice_state public.invoice_status;
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

  SELECT COALESCE(total, 0), status INTO invoice_total, invoice_state
  FROM public.invoices
  WHERE id = NEW.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF invoice_state IN ('draft', 'cancelled') THEN
    RAISE EXCEPTION 'Payments can only be recorded against an issued invoice';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO committed
  FROM public.payments
  WHERE invoice_id = NEW.invoice_id
    AND status IN ('pending', 'confirmed')
    AND id IS DISTINCT FROM NEW.id;

  IF NOT NEW.allow_overpayment AND committed + NEW.amount > invoice_total + 0.009 THEN
    RAISE EXCEPTION 'A payment of % cannot be recorded. % is still available after payments that are pending or confirmed.',
      NEW.amount, GREATEST(invoice_total - committed, 0);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_customer_record(
  p_id uuid,
  p_company_name text,
  p_kra_pin text,
  p_notes text,
  p_phone text,
  p_update_phone boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust public.customers;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('customers.edit') THEN
    RAISE EXCEPTION 'You do not have permission to edit customers' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO cust FROM public.customers WHERE id = p_id FOR UPDATE;
  IF cust.id IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  UPDATE public.customers
  SET company_name = NULLIF(btrim(COALESCE(p_company_name, '')), ''),
      kra_pin = NULLIF(btrim(COALESCE(p_kra_pin, '')), ''),
      notes = NULLIF(btrim(COALESCE(p_notes, '')), '')
  WHERE id = p_id;

  IF p_update_phone THEN
    IF NOT public.has_permission('users.manage') THEN
      RAISE EXCEPTION 'You do not have permission to change this phone number' USING ERRCODE = '42501';
    END IF;
    IF cust.profile_id IS NULL THEN
      RAISE EXCEPTION 'This customer has no user account for a phone number';
    END IF;
    UPDATE public.profiles
    SET phone = NULLIF(btrim(COALESCE(p_phone, '')), '')
    WHERE id = cust.profile_id;
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'That phone number is already used by another account';
END;
$$;

-- ---------------------------------------------------------------------------
-- Work orders
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_request_technician(
  p_request uuid,
  p_technician uuid,
  p_supervisor uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wo public.work_orders;
  created boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('work_orders.assign') THEN
    RAISE EXCEPTION 'You do not have permission to assign technicians' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.service_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request not found';
  END IF;

  SELECT * INTO wo
  FROM public.work_orders
  WHERE service_request_id = p_request
    AND status NOT IN ('completed', 'cancelled')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF wo.id IS NOT NULL THEN
    UPDATE public.work_orders
    SET assigned_to = p_technician,
        supervisor_id = p_supervisor
    WHERE id = wo.id
    RETURNING * INTO wo;
  ELSE
    IF NOT public.has_permission('work_orders.create') THEN
      RAISE EXCEPTION 'You do not have permission to create work orders' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.work_orders (service_request_id, assigned_to, supervisor_id, created_by)
    VALUES (p_request, p_technician, p_supervisor, auth.uid())
    RETURNING * INTO wo;
    created := true;
  END IF;

  RETURN jsonb_build_object('id', wo.id, 'created', created);
END;
$$;

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_request_quotation(
  p_service_request_id uuid,
  p_items jsonb,
  p_send boolean DEFAULT false,
  p_valid_until date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_replace_header boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quote public.quotations;
  updated boolean := false;
  item jsonb;
  item_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('quotations.create') THEN
    RAISE EXCEPTION 'You do not have permission to create quotations' USING ERRCODE = '42501';
  END IF;
  IF p_send AND NOT public.has_permission('quotations.submit') THEN
    RAISE EXCEPTION 'You do not have permission to send quotations' USING ERRCODE = '42501';
  END IF;
  IF p_replace_header AND NOT public.has_permission('quotations.edit') THEN
    RAISE EXCEPTION 'You do not have permission to edit quotations' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  PERFORM 1 FROM public.service_requests WHERE id = p_service_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request not found';
  END IF;

  SELECT * INTO quote
  FROM public.quotations
  WHERE service_request_id = p_service_request_id AND status = 'draft'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF quote.id IS NOT NULL THEN
    updated := true;
    IF p_replace_header THEN
      UPDATE public.quotations
      SET valid_until = p_valid_until,
          notes = NULLIF(btrim(COALESCE(p_notes, '')), '')
      WHERE id = quote.id;
    END IF;
    DELETE FROM public.quotation_items WHERE quotation_id = quote.id;
  ELSE
    INSERT INTO public.quotations (service_request_id, created_by, status, valid_until, notes)
    VALUES (
      p_service_request_id,
      auth.uid(),
      'draft',
      CASE WHEN p_replace_header THEN p_valid_until ELSE NULL END,
      CASE WHEN p_replace_header THEN NULLIF(btrim(COALESCE(p_notes, '')), '') ELSE NULL END
    )
    RETURNING * INTO quote;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF length(btrim(COALESCE(item->>'description', ''))) < 2 THEN
      RAISE EXCEPTION 'Description is required';
    END IF;
    IF COALESCE((item->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;
    IF COALESCE((item->>'unit_price')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Unit price must be zero or more';
    END IF;
    INSERT INTO public.quotation_items (quotation_id, description, quantity, unit_price, inventory_item_id)
    VALUES (
      quote.id,
      btrim(item->>'description'),
      (item->>'quantity')::numeric,
      (item->>'unit_price')::numeric,
      NULLIF(item->>'inventory_item_id', '')::uuid
    );
    item_count := item_count + 1;
  END LOOP;

  IF item_count < 1 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  IF p_send THEN
    UPDATE public.quotations SET status = 'sent' WHERE id = quote.id AND status = 'draft';
  END IF;

  RETURN jsonb_build_object('id', quote.id, 'updated', updated);
END;
$$;

-- ---------------------------------------------------------------------------
-- Accepting a quotation after the jobs are finished
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.quotation_accept_target(
  p_status public.service_status,
  p_open_jobs integer,
  p_finished_jobs integer
) RETURNS public.service_status
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_status NOT IN (
      'quotation_pending',
      'quotation_sent',
      'awaiting_approval',
      'awaiting_spare_parts'
    ) THEN NULL
    WHEN p_open_jobs = 0 AND p_finished_jobs > 0 THEN 'testing'::public.service_status
    ELSE 'under_repair'::public.service_status
  END;
$$;

CREATE OR REPLACE FUNCTION public.apply_quotation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_jobs integer;
  finished_jobs integer;
  req_status public.service_status;
  target public.service_status;
BEGIN
  IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
    UPDATE public.service_requests
    SET status = 'awaiting_approval'
    WHERE id = NEW.service_request_id
      AND status NOT IN ('completed', 'cancelled', 'under_repair', 'testing');
  ELSIF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT
      count(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')),
      count(*) FILTER (WHERE status = 'completed')
    INTO open_jobs, finished_jobs
    FROM public.work_orders
    WHERE service_request_id = NEW.service_request_id;

    SELECT status INTO req_status FROM public.service_requests WHERE id = NEW.service_request_id;
    target := public.quotation_accept_target(req_status, open_jobs, finished_jobs);
    IF target IS NOT NULL THEN
      UPDATE public.service_requests
      SET status = target
      WHERE id = NEW.service_request_id
        AND status = req_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purchase_order_receive_problem(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id = p_id)
      THEN 'Purchase order has no lines'
    WHEN EXISTS (
      SELECT 1 FROM public.purchase_order_items
      WHERE purchase_order_id = p_id AND inventory_item_id IS NULL
    ) THEN 'Every purchase order line needs an inventory item before it can be received'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_id uuid)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po public.purchase_orders;
  line public.purchase_order_items;
  line_count integer := 0;
  problem text;
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

  problem := public.purchase_order_receive_problem(po.id);
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION '%', problem;
  END IF;

  FOR line IN
    SELECT * FROM public.purchase_order_items
    WHERE purchase_order_id = po.id
    FOR UPDATE
  LOOP
    line_count := line_count + 1;
    IF line.inventory_item_id IS NULL THEN
      RAISE EXCEPTION 'Every purchase order line needs an inventory item before it can be received';
    END IF;
    IF line.received_at IS NOT NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.stock_movements (
      inventory_item_id, type, quantity, reason, reference, related_po_id, created_by
    ) VALUES (
      line.inventory_item_id, 'in', line.quantity, 'Purchase order received', po.code, po.id, auth.uid()
    );
    UPDATE public.purchase_order_items SET received_at = now() WHERE id = line.id;
  END LOOP;

  IF line_count = 0 THEN
    RAISE EXCEPTION 'Purchase order has no lines';
  END IF;

  UPDATE public.purchase_orders SET status = 'received' WHERE id = po.id RETURNING * INTO po;
  RETURN po;
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_pending_total(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_pending_total(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.save_customer_record(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_record(uuid, text, text, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_request_technician(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_request_technician(uuid, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.save_request_quotation(uuid, jsonb, boolean, date, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_request_quotation(uuid, jsonb, boolean, date, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.quotation_accept_target(public.service_status, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quotation_accept_target(public.service_status, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.purchase_order_receive_problem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_order_receive_problem(uuid) TO authenticated;
