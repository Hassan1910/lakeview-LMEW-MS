-- Audit trail for role, permission, account, and business record changes.

-- Deleting an account must not erase what that account did.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_email TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS changed_fields TEXT[];

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

CREATE OR REPLACE FUNCTION public.write_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hidden text[] := ARRAY['expo_push_token', 'updated_at'];
  old_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) - hidden END;
  new_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) - hidden END;
  row_key text;
  fields text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key ORDER BY key) INTO fields
    FROM jsonb_each(new_row)
    WHERE new_row -> key IS DISTINCT FROM old_row -> key;
    IF fields IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  row_key := CASE TG_TABLE_NAME
    WHEN 'role_permissions' THEN COALESCE(new_row, old_row) ->> 'role_id'
    ELSE COALESCE(new_row, old_row) ->> 'id'
  END;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity, entity_id, before, after, changed_fields)
  VALUES (
    auth.uid(),
    (SELECT email FROM public.profiles WHERE id = auth.uid()),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN row_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN row_key::uuid END,
    old_row,
    new_row,
    fields
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'roles', 'role_permissions', 'service_requests', 'invoices', 'payments', 'quotations',
    'work_orders', 'purchase_orders', 'customers', 'suppliers', 'inventory_items',
    'stock_movements', 'appointments', 'company_info'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_%1$s ON public.%1$I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trigger_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.write_audit()',
      tbl
    );
  END LOOP;
END $$;

-- Only account-level columns on profiles; push tokens and self-edited contact details stay out of the log.
DROP TRIGGER IF EXISTS trigger_audit_profiles ON public.profiles;
CREATE TRIGGER trigger_audit_profiles
AFTER INSERT OR DELETE OR UPDATE OF role_id, is_active, email, full_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.write_audit();
