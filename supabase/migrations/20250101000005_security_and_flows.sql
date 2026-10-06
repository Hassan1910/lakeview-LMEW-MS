-- Payment authorization, technician write scope, quotation approval, and push dispatch.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_path TEXT;

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type notification_type,
  p_title text,
  p_body text,
  p_data jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data);
  PERFORM public.dispatch_push(p_user_id, p_type::text, p_title, p_body, COALESCE(p_data, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_push(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  secret text;
BEGIN
  base := nullif(current_setting('lmew.functions_base_url', true), '');
  secret := nullif(current_setting('lmew.service_role_key', true), '');
  IF base IS NULL OR secret IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := rtrim(base, '/') || '/send-notification',
    body := jsonb_build_object(
      'user_id', p_user_id,
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'data', p_data,
      'push_only', true
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_push(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_user(uuid, notification_type, text, text, jsonb) FROM PUBLIC;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not installed: %', SQLERRM;
END $$;

DROP POLICY IF EXISTS pay_customer_create ON payments;
CREATE POLICY pay_customer_create ON payments
FOR INSERT WITH CHECK (
  status = 'pending'
  AND amount > 0
  AND invoice_id IN (
    SELECT id FROM invoices
    WHERE customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())
      AND status IN ('issued', 'partially_paid', 'overdue')
      AND balance >= payments.amount
  )
);

CREATE OR REPLACE FUNCTION public.guard_technician_work_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_role() = 'technician' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.service_request_id IS DISTINCT FROM OLD.service_request_id
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id
       OR NEW.code IS DISTINCT FROM OLD.code
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
       OR NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Technicians may only update status, notes, and actual times';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_technician_work_order ON work_orders;
CREATE TRIGGER trigger_guard_technician_work_order
BEFORE UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_technician_work_order_update();

CREATE OR REPLACE FUNCTION public.recalc_invoice_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv_id uuid;
  total_paid numeric;
  inv_total numeric;
  inv_due timestamptz;
  cust_profile uuid;
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.payments
  WHERE invoice_id = inv_id AND status = 'confirmed';

  SELECT total, due_at INTO inv_total, inv_due FROM public.invoices WHERE id = inv_id;

  UPDATE public.invoices
  SET amount_paid = total_paid,
      status = CASE
        WHEN status = 'cancelled' THEN status
        WHEN status = 'draft' AND total_paid = 0 THEN status
        WHEN inv_total IS NOT NULL AND inv_total > 0 AND total_paid >= inv_total THEN 'paid'::invoice_status
        WHEN total_paid > 0 THEN 'partially_paid'::invoice_status
        WHEN inv_due IS NOT NULL AND inv_due < now() THEN 'overdue'::invoice_status
        ELSE 'issued'::invoice_status
      END
  WHERE id = inv_id;

  IF TG_OP <> 'DELETE' AND NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT c.profile_id INTO cust_profile
    FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.id = inv_id;

    PERFORM public.notify_user(
      cust_profile,
      'payment',
      'Payment confirmed',
      'A payment of KES ' || NEW.amount || ' was confirmed.',
      jsonb_build_object('invoice_id', inv_id, 'payment_id', NEW.id)
    );

    PERFORM public.notify_user(id, 'payment', 'Payment confirmed',
      'Invoice payment of KES ' || NEW.amount || ' was confirmed.',
      jsonb_build_object('invoice_id', inv_id, 'payment_id', NEW.id))
    FROM public.profiles
    WHERE role = 'finance_manager' AND is_active = true;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust_profile uuid;
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.service_request_status_history (service_request_id, status, changed_by, note)
    VALUES (
      NEW.id,
      NEW.status,
      auth.uid(),
      CASE
        WHEN TG_OP = 'INSERT' THEN 'Request created'
        ELSE 'Status changed from ' || OLD.status::text || ' to ' || NEW.status::text
      END
    );

    IF TG_OP = 'UPDATE' THEN
      SELECT profile_id INTO cust_profile FROM public.customers WHERE id = NEW.customer_id;
      PERFORM public.notify_user(
        cust_profile,
        'service_status',
        'Service request updated',
        COALESCE(NEW.code, 'Your request') || ' is now ' || replace(NEW.status::text, '_', ' '),
        jsonb_build_object('service_request_id', NEW.id, 'status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_work_order_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    PERFORM public.notify_user(
      NEW.assigned_to,
      'assignment',
      'Work order assigned',
      COALESCE(NEW.code, 'A work order') || ' has been assigned to you.',
      jsonb_build_object('work_order_id', NEW.id, 'service_request_id', NEW.service_request_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_quotation_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust_profile uuid;
BEGIN
  IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
    SELECT c.profile_id INTO cust_profile
    FROM public.service_requests sr
    JOIN public.customers c ON c.id = sr.customer_id
    WHERE sr.id = NEW.service_request_id;
    PERFORM public.notify_user(
      cust_profile,
      'quotation',
      'Quotation ready',
      COALESCE(NEW.code, 'A quotation') || ' is ready for your review.',
      jsonb_build_object('quotation_id', NEW.id, 'service_request_id', NEW.service_request_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_invoice_issued()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust_profile uuid;
BEGIN
  IF NEW.status = 'issued' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'issued') THEN
    SELECT profile_id INTO cust_profile FROM public.customers WHERE id = NEW.customer_id;
    PERFORM public.notify_user(
      cust_profile,
      'invoice',
      'Invoice issued',
      COALESCE(NEW.code, 'An invoice') || ' has been issued.',
      jsonb_build_object('invoice_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_on_hand <= NEW.reorder_level
     AND (TG_OP = 'INSERT' OR OLD.quantity_on_hand IS DISTINCT FROM NEW.quantity_on_hand)
     AND (TG_OP = 'INSERT' OR OLD.quantity_on_hand > NEW.reorder_level) THEN
    PERFORM public.notify_user(
      id,
      'low_stock',
      'Low stock: ' || NEW.name,
      'Stock for ' || NEW.name || ' (' || NEW.sku || ') is ' || NEW.quantity_on_hand || '. Reorder level: ' || NEW.reorder_level,
      jsonb_build_object('inventory_item_id', NEW.id, 'sku', NEW.sku)
    )
    FROM public.profiles
    WHERE role IN ('store_manager', 'administrator') AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_customer_quotation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_role() = 'customer' THEN
    IF OLD.status <> 'sent' OR NEW.status NOT IN ('accepted', 'rejected') THEN
      RAISE EXCEPTION 'Customers may only accept or reject a sent quotation';
    END IF;
    NEW.code := OLD.code;
    NEW.service_request_id := OLD.service_request_id;
    NEW.currency := OLD.currency;
    NEW.subtotal := OLD.subtotal;
    NEW.tax_rate := OLD.tax_rate;
    NEW.tax_amount := OLD.tax_amount;
    NEW.discount := OLD.discount;
    NEW.total := OLD.total;
    NEW.valid_until := OLD.valid_until;
    NEW.notes := OLD.notes;
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_customer_quotation ON quotations;
CREATE TRIGGER trigger_guard_customer_quotation
BEFORE UPDATE ON quotations
FOR EACH ROW EXECUTE FUNCTION public.guard_customer_quotation_update();

CREATE OR REPLACE FUNCTION public.apply_quotation_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'sent') THEN
    UPDATE public.service_requests
    SET status = 'awaiting_approval'
    WHERE id = NEW.service_request_id
      AND status NOT IN ('completed', 'cancelled', 'under_repair', 'testing');
  ELSIF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE public.service_requests
    SET status = 'under_repair'
    WHERE id = NEW.service_request_id
      AND status NOT IN ('completed', 'cancelled');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_quotation_status ON quotations;
CREATE TRIGGER trigger_apply_quotation_status
AFTER INSERT OR UPDATE OF status ON quotations
FOR EACH ROW EXECUTE FUNCTION public.apply_quotation_status();

DROP POLICY IF EXISTS q_customer_respond ON quotations;
CREATE POLICY q_customer_respond ON quotations
FOR UPDATE
USING (
  public.current_role() = 'customer'
  AND status = 'sent'
  AND service_request_id IN (
    SELECT id FROM service_requests WHERE customer_id IN (
      SELECT id FROM customers WHERE profile_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.current_role() = 'customer'
  AND status IN ('accepted', 'rejected')
  AND service_request_id IN (
    SELECT id FROM service_requests WHERE customer_id IN (
      SELECT id FROM customers WHERE profile_id = auth.uid()
    )
  )
);

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
  IF public.current_role() NOT IN ('administrator', 'finance_manager') THEN
    RAISE EXCEPTION 'Only finance can issue invoices';
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
    subtotal, tax_amount, total, issued_at, due_at, created_by
  ) VALUES (
    quote.id, quote.service_request_id, customer, 'issued', quote.currency,
    quote.subtotal, quote.tax_amount, quote.total, now(), now() + interval '14 days', auth.uid()
  )
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_invoice_from_quotation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_invoice_from_quotation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_catalog(q text)
RETURNS TABLE (kind text, id uuid, title text, subtitle text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM (
    SELECT 'service_request'::text, sr.id, COALESCE(sr.code, sr.title), sr.title
    FROM public.service_requests sr
    WHERE length(trim(q)) > 0
      AND to_tsvector('simple', coalesce(sr.code, '') || ' ' || coalesce(sr.title, '') || ' ' || coalesce(sr.description, ''))
          @@ plainto_tsquery('simple', q)
    UNION ALL
    SELECT 'customer'::text, c.id, COALESCE(c.company_name, p.full_name, 'Customer'), COALESCE(p.email, '')
    FROM public.customers c
    LEFT JOIN public.profiles p ON p.id = c.profile_id
    WHERE length(trim(q)) > 0
      AND to_tsvector('simple', coalesce(c.company_name, '') || ' ' || coalesce(p.full_name, '') || ' ' || coalesce(p.email, ''))
          @@ plainto_tsquery('simple', q)
    UNION ALL
    SELECT 'vessel'::text, v.id, v.name, COALESCE(v.registration_no, '')
    FROM public.vessels v
    WHERE length(trim(q)) > 0
      AND to_tsvector('simple', coalesce(v.name, '') || ' ' || coalesce(v.registration_no, ''))
          @@ plainto_tsquery('simple', q)
    UNION ALL
    SELECT 'inventory'::text, i.id, i.name, i.sku
    FROM public.inventory_items i
    WHERE length(trim(q)) > 0
      AND to_tsvector('simple', coalesce(i.name, '') || ' ' || coalesce(i.sku, '') || ' ' || coalesce(i.description, ''))
          @@ plainto_tsquery('simple', q)
  ) matches
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.search_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_catalog(text) TO authenticated;

CREATE INDEX IF NOT EXISTS service_requests_fts ON service_requests USING gin (
  to_tsvector('simple', coalesce(code, '') || ' ' || coalesce(title, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX IF NOT EXISTS vessels_fts ON vessels USING gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(registration_no, ''))
);
CREATE INDEX IF NOT EXISTS inventory_items_fts ON inventory_items USING gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(description, ''))
);

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS invoice_proof_customer_write ON storage.objects';
  EXECUTE $p$CREATE POLICY invoice_proof_customer_write ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'invoice-pdfs'
      AND (storage.foldername(name))[2] = 'proofs'
      AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.invoices WHERE customer_id IN (
          SELECT id FROM public.customers WHERE profile_id = auth.uid()
        )
      )
    )$p$;
END $$;
