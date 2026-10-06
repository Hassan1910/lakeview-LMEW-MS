-- Keep purchase_orders.total equal to the sum of its line totals.
CREATE OR REPLACE FUNCTION public.recalc_purchase_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po_id uuid;
BEGIN
  po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  UPDATE public.purchase_orders
  SET total = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM public.purchase_order_items
    WHERE purchase_order_id = po_id
  )
  WHERE id = po_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_recalc_purchase_order_total ON public.purchase_order_items;
CREATE TRIGGER trigger_recalc_purchase_order_total
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_purchase_order_total();

UPDATE public.purchase_orders po
SET total = COALESCE((
  SELECT SUM(line_total) FROM public.purchase_order_items WHERE purchase_order_id = po.id
), 0);

REVOKE ALL ON FUNCTION public.recalc_purchase_order_total() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_purchase_order_total() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_purchase_order_total() TO service_role;
