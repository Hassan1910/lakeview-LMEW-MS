-- Stored functions and triggers aligned to the LMEW schema.

CREATE SEQUENCE IF NOT EXISTS service_request_code_seq;
CREATE SEQUENCE IF NOT EXISTS invoice_code_seq;
CREATE SEQUENCE IF NOT EXISTS work_order_code_seq;
CREATE SEQUENCE IF NOT EXISTS quotation_code_seq;
CREATE SEQUENCE IF NOT EXISTS purchase_order_code_seq;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.current_role() TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_updated_at ON %I;', t);
    EXECUTE format(
      'CREATE TRIGGER trigger_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t
    );
  END LOOP;
END $$;

-- Signup always creates a customer profile. Role changes are an administrator action.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, 'customer'), '@', 1)),
    NEW.email,
    COALESCE(NEW.phone, NULLIF(NEW.raw_user_meta_data->>'phone', '')),
    'customer'::user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
    INSERT INTO public.service_request_status_history (
      service_request_id, status, changed_by, note
    ) VALUES (
      NEW.id,
      NEW.status,
      auth.uid(),
      CASE
        WHEN TG_OP = 'INSERT' THEN 'Request created'
        ELSE 'Status changed from ' || OLD.status::text || ' to ' || NEW.status::text
      END
    );

    SELECT profile_id INTO cust_profile FROM public.customers WHERE id = NEW.customer_id;
    IF cust_profile IS NOT NULL AND (TG_OP = 'UPDATE') THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
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

DROP TRIGGER IF EXISTS trigger_log_status_change ON service_requests;
CREATE TRIGGER trigger_log_status_change
AFTER INSERT OR UPDATE OF status ON service_requests
FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

CREATE OR REPLACE FUNCTION public.generate_service_request_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'LMEW-SR-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('service_request_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_service_request_code ON service_requests;
CREATE TRIGGER trigger_service_request_code
BEFORE INSERT ON service_requests
FOR EACH ROW EXECUTE FUNCTION public.generate_service_request_code();

CREATE OR REPLACE FUNCTION public.generate_invoice_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'LMEW-INV-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('invoice_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_invoice_code ON invoices;
CREATE TRIGGER trigger_invoice_code
BEFORE INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_code();

CREATE OR REPLACE FUNCTION public.generate_work_order_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'LMEW-WO-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('work_order_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_work_order_code ON work_orders;
CREATE TRIGGER trigger_work_order_code
BEFORE INSERT ON work_orders
FOR EACH ROW EXECUTE FUNCTION public.generate_work_order_code();

CREATE OR REPLACE FUNCTION public.generate_quotation_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'LMEW-QT-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('quotation_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quotation_code ON quotations;
CREATE TRIGGER trigger_quotation_code
BEFORE INSERT ON quotations
FOR EACH ROW EXECUTE FUNCTION public.generate_quotation_code();

CREATE OR REPLACE FUNCTION public.generate_purchase_order_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'LMEW-PO-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('purchase_order_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_purchase_order_code ON purchase_orders;
CREATE TRIGGER trigger_purchase_order_code
BEFORE INSERT ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.generate_purchase_order_code();

-- Quantity changes live on stock_movements so every source (parts issue, receipt, adjustment) stays consistent.
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric;
  on_hand numeric;
BEGIN
  delta := CASE NEW.type
    WHEN 'out' THEN -NEW.quantity
    ELSE NEW.quantity
  END;

  SELECT quantity_on_hand INTO on_hand FROM public.inventory_items WHERE id = NEW.inventory_item_id FOR UPDATE;
  IF on_hand IS NULL THEN
    RAISE EXCEPTION 'Inventory item % not found', NEW.inventory_item_id;
  END IF;
  IF on_hand + delta < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for item %', NEW.inventory_item_id;
  END IF;

  UPDATE public.inventory_items
  SET quantity_on_hand = quantity_on_hand + delta
  WHERE id = NEW.inventory_item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_stock_movement ON stock_movements;
CREATE TRIGGER trigger_apply_stock_movement
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

CREATE OR REPLACE FUNCTION public.decrement_stock_on_work_order_part()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_movements (
    inventory_item_id, type, quantity, reason, related_work_order_id, created_by
  ) VALUES (
    NEW.inventory_item_id,
    'out',
    NEW.quantity,
    'Parts issued for work order',
    NEW.work_order_id,
    COALESCE(NEW.requested_by, auth.uid())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_decrement_stock_on_work_order_part ON work_order_parts;
CREATE TRIGGER trigger_decrement_stock_on_work_order_part
AFTER INSERT ON work_order_parts
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_work_order_part();

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
    INSERT INTO public.notifications (user_id, title, body, type, data)
    SELECT
      id,
      'Low stock: ' || NEW.name,
      'Stock for ' || NEW.name || ' (' || NEW.sku || ') is ' || NEW.quantity_on_hand || '. Reorder level: ' || NEW.reorder_level,
      'low_stock'::notification_type,
      jsonb_build_object('inventory_item_id', NEW.id, 'sku', NEW.sku)
    FROM public.profiles
    WHERE role IN ('store_manager', 'administrator') AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_low_stock ON inventory_items;
CREATE TRIGGER trigger_notify_low_stock
AFTER INSERT OR UPDATE OF quantity_on_hand ON inventory_items
FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

CREATE OR REPLACE FUNCTION public.recalc_quotation_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q_id uuid;
  sub numeric;
BEGIN
  q_id := COALESCE(NEW.quotation_id, OLD.quotation_id);
  SELECT COALESCE(SUM(line_total), 0) INTO sub FROM public.quotation_items WHERE quotation_id = q_id;
  UPDATE public.quotations
  SET subtotal = sub,
      tax_amount = round(sub * (tax_rate / 100.0), 2),
      total = sub + round(sub * (tax_rate / 100.0), 2) - COALESCE(discount, 0)
  WHERE id = q_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_recalc_quotation ON quotation_items;
CREATE TRIGGER trigger_recalc_quotation
AFTER INSERT OR UPDATE OR DELETE ON quotation_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_quotation_totals();

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
  cust_profile uuid;
BEGIN
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.payments
  WHERE invoice_id = inv_id AND status = 'confirmed';

  SELECT total INTO inv_total FROM public.invoices WHERE id = inv_id;

  UPDATE public.invoices
  SET amount_paid = total_paid,
      status = CASE
        WHEN status IN ('cancelled', 'draft') AND total_paid = 0 THEN status
        WHEN inv_total IS NOT NULL AND inv_total > 0 AND total_paid >= inv_total THEN 'paid'::invoice_status
        WHEN total_paid > 0 THEN 'partially_paid'::invoice_status
        WHEN status = 'paid' THEN 'issued'::invoice_status
        ELSE status
      END
  WHERE id = inv_id;

  IF TG_OP <> 'DELETE' AND NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
    SELECT c.profile_id INTO cust_profile
    FROM public.invoices i
    JOIN public.customers c ON c.id = i.customer_id
    WHERE i.id = inv_id;

    IF cust_profile IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        cust_profile,
        'payment',
        'Payment confirmed',
        'A payment of KES ' || NEW.amount || ' was confirmed.',
        jsonb_build_object('invoice_id', inv_id, 'payment_id', NEW.id)
      );
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT id, 'payment', 'Payment confirmed',
      'Invoice payment of KES ' || NEW.amount || ' was confirmed.',
      jsonb_build_object('invoice_id', inv_id, 'payment_id', NEW.id)
    FROM public.profiles
    WHERE role = 'finance_manager' AND is_active = true;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_recalc_invoice ON payments;
CREATE TRIGGER trigger_recalc_invoice
AFTER INSERT OR UPDATE OF status OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_balance();

CREATE OR REPLACE FUNCTION public.notify_work_order_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
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

DROP TRIGGER IF EXISTS trigger_notify_work_order_assigned ON work_orders;
CREATE TRIGGER trigger_notify_work_order_assigned
AFTER INSERT OR UPDATE OF assigned_to ON work_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_work_order_assigned();

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
    IF cust_profile IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        cust_profile, 'quotation', 'Quotation ready',
        COALESCE(NEW.code, 'A quotation') || ' is ready for your review.',
        jsonb_build_object('quotation_id', NEW.id, 'service_request_id', NEW.service_request_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_quotation_sent ON quotations;
CREATE TRIGGER trigger_notify_quotation_sent
AFTER INSERT OR UPDATE OF status ON quotations
FOR EACH ROW EXECUTE FUNCTION public.notify_quotation_sent();

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
    IF cust_profile IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        cust_profile, 'invoice', 'Invoice issued',
        COALESCE(NEW.code, 'An invoice') || ' has been issued.',
        jsonb_build_object('invoice_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_invoice_issued ON invoices;
CREATE TRIGGER trigger_notify_invoice_issued
AFTER INSERT OR UPDATE OF status ON invoices
FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_issued();

CREATE OR REPLACE FUNCTION public.write_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_id uuid;
BEGIN
  row_id := COALESCE(NEW.id, OLD.id);
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, before, after)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    row_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_service_requests ON service_requests;
CREATE TRIGGER trigger_audit_service_requests
AFTER INSERT OR UPDATE OR DELETE ON service_requests
FOR EACH ROW EXECUTE FUNCTION public.write_audit();

DROP TRIGGER IF EXISTS trigger_audit_invoices ON invoices;
CREATE TRIGGER trigger_audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION public.write_audit();

DROP TRIGGER IF EXISTS trigger_audit_payments ON payments;
CREATE TRIGGER trigger_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION public.write_audit();
