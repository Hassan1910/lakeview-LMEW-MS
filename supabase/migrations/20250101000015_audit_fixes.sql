-- Integrity fixes from the system audit.
-- Payments stay off draft and cancelled invoices.
-- Suppliers cannot mark a purchase order received.
-- Accepting a quotation does not pull a finished job out of testing.
-- One open invoice per quotation.
-- Stock on hand follows movement edits, deletes, and part returns.
-- amount_paid cannot be typed in by hand.

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

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
    RAISE EXCEPTION 'Payment of % exceeds the % still available on this invoice',
      NEW.amount, GREATEST(invoice_total - committed, 0);
  END IF;

  RETURN NEW;
END;
$$;

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
        WHEN status IN ('cancelled', 'draft') THEN status
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

    PERFORM public.notify_user(holder, 'payment', 'Payment confirmed',
      'Invoice payment of KES ' || NEW.amount || ' was confirmed.',
      jsonb_build_object('invoice_id', inv_id, 'payment_id', NEW.id))
    FROM public.permission_holders('payments.approve', false) AS holder;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_invoice_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() = 1 AND NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
    RAISE EXCEPTION 'Invoice amount paid is calculated from payments';
  END IF;
  IF NEW.status = 'issued' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
    PERFORM public.require_permission('invoices.approve');
  ELSIF NEW.status = 'cancelled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'cancelled') THEN
    PERFORM public.require_permission('invoices.reject');
  END IF;
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() = 1
     AND public.changed_beyond(to_jsonb(OLD), to_jsonb(NEW), ARRAY['status', 'issued_at']) THEN
    PERFORM public.require_permission('invoices.edit');
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_supplier_po_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.current_role() = 'supplier' THEN
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.total IS DISTINCT FROM OLD.total
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION 'Suppliers may only update purchase order status';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (
         (OLD.status = 'sent' AND NEW.status IN ('acknowledged', 'shipped'))
         OR (OLD.status = 'acknowledged' AND NEW.status = 'shipped')
       ) THEN
      RAISE EXCEPTION 'Suppliers may only acknowledge or ship a purchase order';
    END IF;
  END IF;
  RETURN NEW;
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

-- ---------------------------------------------------------------------------
-- Quotations and invoices
-- ---------------------------------------------------------------------------

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
    UPDATE public.service_requests sr
    SET status = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.work_orders wo
        WHERE wo.service_request_id = sr.id
          AND wo.status NOT IN ('completed', 'cancelled')
      ) AND EXISTS (
        SELECT 1 FROM public.work_orders wo
        WHERE wo.service_request_id = sr.id
          AND wo.status = 'completed'
      ) THEN 'testing'::public.service_status
      ELSE 'under_repair'::public.service_status
    END
    WHERE sr.id = NEW.service_request_id
      AND sr.status IN (
        'quotation_pending',
        'quotation_sent',
        'awaiting_approval',
        'awaiting_spare_parts'
      );
  END IF;
  RETURN NEW;
END;
$$;

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

  SELECT * INTO quote FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
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

DO $$
BEGIN
  IF EXISTS (
    SELECT quotation_id
    FROM public.invoices
    WHERE quotation_id IS NOT NULL AND status <> 'cancelled'
    GROUP BY quotation_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one open invoice per quotation until duplicate invoices are cancelled';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_open_per_quotation
  ON public.invoices (quotation_id)
  WHERE quotation_id IS NOT NULL AND status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stock_movement_delta(movement_type public.stock_movement_type, qty numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE movement_type WHEN 'out' THEN -qty ELSE qty END;
$$;

CREATE OR REPLACE FUNCTION public.assert_stock_quantity(movement_type public.stock_movement_type, qty numeric)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF qty IS NULL OR qty = 0 THEN
    RAISE EXCEPTION 'Stock movement quantity cannot be zero';
  END IF;
  IF movement_type IS DISTINCT FROM 'adjustment' AND qty < 0 THEN
    RAISE EXCEPTION 'Only adjustments can use a negative quantity';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_inventory_delta(p_item uuid, p_delta numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  on_hand numeric;
BEGIN
  SELECT quantity_on_hand INTO on_hand FROM public.inventory_items WHERE id = p_item FOR UPDATE;
  IF on_hand IS NULL THEN
    RAISE EXCEPTION 'Inventory item % not found', p_item;
  END IF;
  IF on_hand + p_delta < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for item %', p_item;
  END IF;
  UPDATE public.inventory_items
  SET quantity_on_hand = quantity_on_hand + p_delta
  WHERE id = p_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_stock_quantity(NEW.type, NEW.quantity);
  PERFORM public.apply_inventory_delta(NEW.inventory_item_id, public.stock_movement_delta(NEW.type, NEW.quantity));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_stock_movement_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_inventory_delta(
      OLD.inventory_item_id,
      -public.stock_movement_delta(OLD.type, OLD.quantity)
    );
    RETURN OLD;
  END IF;

  IF NEW.inventory_item_id IS NOT DISTINCT FROM OLD.inventory_item_id
     AND NEW.type IS NOT DISTINCT FROM OLD.type
     AND NEW.quantity IS NOT DISTINCT FROM OLD.quantity THEN
    RETURN NEW;
  END IF;

  PERFORM public.assert_stock_quantity(NEW.type, NEW.quantity);
  PERFORM public.apply_inventory_delta(
    OLD.inventory_item_id,
    -public.stock_movement_delta(OLD.type, OLD.quantity)
  );
  PERFORM public.apply_inventory_delta(
    NEW.inventory_item_id,
    public.stock_movement_delta(NEW.type, NEW.quantity)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_stock_movement_change ON public.stock_movements;
CREATE TRIGGER trigger_sync_stock_movement_change
BEFORE UPDATE OF quantity, type, inventory_item_id OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.sync_stock_movement_change();

CREATE OR REPLACE FUNCTION public.restore_stock_on_work_order_part_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_movements (
    inventory_item_id, type, quantity, reason, related_work_order_id, created_by
  ) VALUES (
    OLD.inventory_item_id,
    'return',
    ABS(OLD.quantity),
    'Parts returned from work order',
    OLD.work_order_id,
    auth.uid()
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_restore_stock_on_work_order_part_delete ON public.work_order_parts;
CREATE TRIGGER trigger_restore_stock_on_work_order_part_delete
AFTER DELETE ON public.work_order_parts
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_work_order_part_delete();

CREATE OR REPLACE FUNCTION public.sync_work_order_part_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric;
BEGIN
  IF NEW.inventory_item_id IS DISTINCT FROM OLD.inventory_item_id THEN
    RAISE EXCEPTION 'Return the issued part before issuing a different item';
  END IF;
  IF NEW.quantity IS NOT DISTINCT FROM OLD.quantity THEN
    RETURN NEW;
  END IF;
  delta := NEW.quantity - OLD.quantity;
  IF delta > 0 THEN
    INSERT INTO public.stock_movements (
      inventory_item_id, type, quantity, reason, related_work_order_id, created_by
    ) VALUES (
      NEW.inventory_item_id, 'out', delta, 'Additional parts issued for work order', NEW.work_order_id, auth.uid()
    );
  ELSIF delta < 0 THEN
    INSERT INTO public.stock_movements (
      inventory_item_id, type, quantity, reason, related_work_order_id, created_by
    ) VALUES (
      NEW.inventory_item_id, 'return', ABS(delta), 'Parts returned from work order', NEW.work_order_id, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_work_order_part_quantity ON public.work_order_parts;
CREATE TRIGGER trigger_sync_work_order_part_quantity
BEFORE UPDATE OF quantity, inventory_item_id ON public.work_order_parts
FOR EACH ROW EXECUTE FUNCTION public.sync_work_order_part_quantity();

REVOKE ALL ON FUNCTION public.stock_movement_delta(public.stock_movement_type, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_stock_quantity(public.stock_movement_type, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_inventory_delta(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_stock_movement_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_stock_on_work_order_part_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_work_order_part_quantity() FROM PUBLIC, anon, authenticated;
