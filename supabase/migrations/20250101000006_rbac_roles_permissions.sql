-- Admin-managed roles and a granular permission catalog.
-- profiles.role stays as a text copy of roles.key so mobile role checks keep working;
-- profiles.role_id is the source of truth and drives has_permission().

-- ---------------------------------------------------------------------------
-- 1. Catalog tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_]{1,48}$'),
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.permissions (
    key TEXT PRIMARY KEY,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key ON public.role_permissions(permission_key);

DROP TRIGGER IF EXISTS trigger_set_updated_at ON public.roles;
CREATE TRIGGER trigger_set_updated_at BEFORE UPDATE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.roles (key, name, description, is_system) VALUES
  ('administrator', 'Administrator', 'Full access to every module, including users, roles, and system settings.', true),
  ('service_manager', 'Service Manager', 'Runs service requests, work orders, quotations, customers, and vessels.', true),
  ('supervisor', 'Supervisor', 'Oversees technicians, work orders, and service progress.', true),
  ('finance_manager', 'Finance', 'Manages invoices, payments, quotations, and financial reports.', true),
  ('store_manager', 'Store Manager', 'Manages inventory, stock movements, suppliers, and parts issued to jobs.', true),
  ('procurement_officer', 'Procurement Officer', 'Manages suppliers, purchase orders, and stock received.', true),
  ('receptionist', 'Receptionist', 'Front desk: walk-in customers, appointments, and requests on behalf of customers.', true),
  ('supplier', 'Supplier', 'External supplier portal limited to their own purchase orders.', true),
  ('technician', 'Technician', 'Mobile app user who works on assigned jobs.', true),
  ('customer', 'Customer', 'Mobile app customer who sees only their own vessels, requests, and invoices.', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.permissions (key, module, action, description) VALUES
  ('portal.access', 'portal', 'access', 'Sign in to the web dashboard'),
  ('dashboard.view', 'dashboard', 'view', 'See the overview dashboard'),
  ('directory.view', 'directory', 'view', 'See names and contact details of all accounts'),
  ('users.view', 'users', 'view', 'See user accounts and their roles'),
  ('users.manage', 'users', 'manage', 'Create, suspend, remove, and change roles of user accounts'),
  ('roles.view', 'roles', 'view', 'See roles and their permissions'),
  ('roles.manage', 'roles', 'manage', 'Create and edit roles and their permissions'),
  ('audit.view', 'audit', 'view', 'Read the audit log'),
  ('company.edit', 'company', 'edit', 'Edit the company profile'),
  ('settings.manage', 'settings', 'manage', 'Open system settings'),
  ('team.view', 'team', 'view', 'See technicians and the jobs assigned under you'),
  ('customers.view', 'customers', 'view', 'See customers'),
  ('customers.create', 'customers', 'create', 'Add customers, including walk-ins'),
  ('customers.edit', 'customers', 'edit', 'Edit customers'),
  ('customers.delete', 'customers', 'delete', 'Delete customers'),
  ('vessels.view', 'vessels', 'view', 'See vessels'),
  ('vessels.create', 'vessels', 'create', 'Add vessels'),
  ('vessels.edit', 'vessels', 'edit', 'Edit vessels and their photos'),
  ('vessels.delete', 'vessels', 'delete', 'Delete vessels'),
  ('service_requests.view', 'service_requests', 'view', 'See service requests, timelines, and attachments'),
  ('service_requests.create', 'service_requests', 'create', 'Create service requests on behalf of customers'),
  ('service_requests.edit', 'service_requests', 'edit', 'Update service request details and status'),
  ('service_requests.delete', 'service_requests', 'delete', 'Delete service requests'),
  ('service_requests.assign', 'service_requests', 'assign', 'Assign a service manager to a request'),
  ('service_requests.view_reports', 'service_requests', 'view_reports', 'See service and technician reports'),
  ('work_orders.view', 'work_orders', 'view', 'See work orders and their media'),
  ('work_orders.create', 'work_orders', 'create', 'Create work orders'),
  ('work_orders.edit', 'work_orders', 'edit', 'Update work orders'),
  ('work_orders.delete', 'work_orders', 'delete', 'Delete work orders'),
  ('work_orders.assign', 'work_orders', 'assign', 'Assign technicians and supervisors'),
  ('work_order_parts.view', 'work_order_parts', 'view', 'See parts issued to jobs'),
  ('work_order_parts.manage', 'work_order_parts', 'manage', 'Issue and adjust parts on jobs'),
  ('quotations.view', 'quotations', 'view', 'See quotations'),
  ('quotations.create', 'quotations', 'create', 'Draft quotations'),
  ('quotations.edit', 'quotations', 'edit', 'Edit quotations and their lines'),
  ('quotations.delete', 'quotations', 'delete', 'Delete quotations'),
  ('quotations.submit', 'quotations', 'submit', 'Send quotations to customers'),
  ('quotations.approve', 'quotations', 'approve', 'Mark quotations accepted on behalf of a customer'),
  ('quotations.reject', 'quotations', 'reject', 'Mark quotations rejected on behalf of a customer'),
  ('quotations.print', 'quotations', 'print', 'Generate quotation PDFs'),
  ('invoices.view', 'invoices', 'view', 'See invoices'),
  ('invoices.create', 'invoices', 'create', 'Create draft invoices'),
  ('invoices.edit', 'invoices', 'edit', 'Edit invoices'),
  ('invoices.delete', 'invoices', 'delete', 'Delete invoices'),
  ('invoices.approve', 'invoices', 'approve', 'Issue invoices to customers'),
  ('invoices.reject', 'invoices', 'reject', 'Cancel invoices'),
  ('invoices.print', 'invoices', 'print', 'Generate invoice PDFs'),
  ('invoices.export', 'invoices', 'export', 'Export invoice data'),
  ('invoices.view_reports', 'invoices', 'view_reports', 'See financial reports'),
  ('payments.view', 'payments', 'view', 'See payments'),
  ('payments.create', 'payments', 'create', 'Record payments and start online payments'),
  ('payments.edit', 'payments', 'edit', 'Edit payment details'),
  ('payments.delete', 'payments', 'delete', 'Delete payments'),
  ('payments.approve', 'payments', 'approve', 'Confirm or refund payments'),
  ('payments.reject', 'payments', 'reject', 'Mark payments failed'),
  ('payments.export', 'payments', 'export', 'Export payment data'),
  ('inventory.view', 'inventory', 'view', 'See inventory items and categories'),
  ('inventory.create', 'inventory', 'create', 'Add inventory items and categories'),
  ('inventory.edit', 'inventory', 'edit', 'Edit inventory items'),
  ('inventory.delete', 'inventory', 'delete', 'Delete inventory items'),
  ('inventory.export', 'inventory', 'export', 'Export inventory data'),
  ('inventory.view_reports', 'inventory', 'view_reports', 'See inventory and low-stock reports'),
  ('stock_movements.view', 'stock_movements', 'view', 'See stock movements'),
  ('stock_movements.create', 'stock_movements', 'create', 'Record stock in, out, and adjustments'),
  ('stock_movements.edit', 'stock_movements', 'edit', 'Edit stock movement notes'),
  ('stock_movements.delete', 'stock_movements', 'delete', 'Delete stock movements'),
  ('suppliers.view', 'suppliers', 'view', 'See suppliers'),
  ('suppliers.create', 'suppliers', 'create', 'Add suppliers'),
  ('suppliers.edit', 'suppliers', 'edit', 'Edit suppliers'),
  ('suppliers.delete', 'suppliers', 'delete', 'Delete suppliers'),
  ('purchase_orders.view', 'purchase_orders', 'view', 'See all purchase orders'),
  ('purchase_orders.create', 'purchase_orders', 'create', 'Draft purchase orders'),
  ('purchase_orders.edit', 'purchase_orders', 'edit', 'Edit purchase orders, lines, and receive stock'),
  ('purchase_orders.delete', 'purchase_orders', 'delete', 'Delete purchase orders'),
  ('purchase_orders.approve', 'purchase_orders', 'approve', 'Approve purchase orders and send them to suppliers'),
  ('purchase_orders.view_own', 'purchase_orders', 'view_own', 'Supplier: see purchase orders for your own supplier account'),
  ('purchase_orders.edit_own', 'purchase_orders', 'edit_own', 'Supplier: acknowledge and ship your own purchase orders'),
  ('feedback.view', 'feedback', 'view', 'See customer feedback'),
  ('feedback.edit', 'feedback', 'edit', 'Respond to customer feedback'),
  ('messages.view', 'messages', 'view', 'Read every service request conversation'),
  ('messages.create', 'messages', 'create', 'Send messages on service requests'),
  ('appointments.view', 'appointments', 'view', 'See appointments'),
  ('appointments.create', 'appointments', 'create', 'Schedule appointments'),
  ('appointments.edit', 'appointments', 'edit', 'Edit appointments'),
  ('appointments.delete', 'appointments', 'delete', 'Delete appointments')
ON CONFLICT (key) DO UPDATE SET module = EXCLUDED.module, action = EXCLUDED.action, description = EXCLUDED.description;

-- Default grants reproduce the access each role had under the role-list policies.
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, g.permission_key
FROM (VALUES
  ('service_manager', ARRAY[
    'portal.access','dashboard.view','directory.view','customers.view',
    'vessels.view','vessels.create','vessels.edit','vessels.delete',
    'service_requests.view','service_requests.create','service_requests.edit','service_requests.delete','service_requests.assign','service_requests.view_reports',
    'work_orders.view','work_orders.create','work_orders.edit','work_orders.delete','work_orders.assign',
    'work_order_parts.view','work_order_parts.manage',
    'quotations.view','quotations.create','quotations.edit','quotations.delete','quotations.submit','quotations.approve','quotations.reject','quotations.print',
    'invoices.print','inventory.view','inventory.view_reports',
    'feedback.view','feedback.edit','messages.view','messages.create',
    'appointments.view','appointments.create','appointments.edit','appointments.delete']),
  ('supervisor', ARRAY[
    'portal.access','dashboard.view','directory.view','team.view',
    'vessels.view','vessels.create','vessels.edit','vessels.delete',
    'service_requests.view','service_requests.create','service_requests.edit','service_requests.delete','service_requests.assign','service_requests.view_reports',
    'work_orders.view','work_orders.create','work_orders.edit','work_orders.delete','work_orders.assign',
    'work_order_parts.view','feedback.view','messages.view','messages.create']),
  ('finance_manager', ARRAY[
    'portal.access','dashboard.view','customers.view',
    'service_requests.view','service_requests.create','service_requests.edit','service_requests.delete',
    'quotations.view','quotations.create','quotations.edit','quotations.delete','quotations.submit','quotations.approve','quotations.reject','quotations.print',
    'invoices.view','invoices.create','invoices.edit','invoices.delete','invoices.approve','invoices.reject','invoices.print','invoices.export','invoices.view_reports',
    'payments.view','payments.create','payments.edit','payments.delete','payments.approve','payments.reject','payments.export',
    'inventory.view']),
  ('store_manager', ARRAY[
    'portal.access','dashboard.view',
    'inventory.view','inventory.create','inventory.edit','inventory.delete','inventory.export','inventory.view_reports',
    'stock_movements.view','stock_movements.create','stock_movements.edit','stock_movements.delete',
    'suppliers.view','suppliers.create','suppliers.edit','suppliers.delete',
    'purchase_orders.view','purchase_orders.create','purchase_orders.edit','purchase_orders.delete','purchase_orders.approve',
    'work_order_parts.view','work_order_parts.manage']),
  ('procurement_officer', ARRAY[
    'portal.access','dashboard.view','inventory.view',
    'stock_movements.view','stock_movements.create','stock_movements.edit','stock_movements.delete',
    'suppliers.view','suppliers.create','suppliers.edit','suppliers.delete',
    'purchase_orders.view','purchase_orders.create','purchase_orders.edit','purchase_orders.delete','purchase_orders.approve']),
  ('receptionist', ARRAY[
    'portal.access','dashboard.view','directory.view',
    'customers.view','customers.create','customers.edit','inventory.view',
    'service_requests.view','service_requests.create','service_requests.edit','service_requests.delete',
    'messages.create',
    'appointments.view','appointments.create','appointments.edit','appointments.delete']),
  ('supplier', ARRAY['portal.access','purchase_orders.view_own','purchase_orders.edit_own']),
  ('technician', ARRAY['vessels.view','vessels.create','vessels.edit','vessels.delete','inventory.view'])
) AS seed(role_key, keys)
CROSS JOIN LATERAL unnest(seed.keys) AS g(permission_key)
JOIN public.roles r ON r.key = seed.role_key
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Move profiles from the role enum to roles
-- ---------------------------------------------------------------------------

-- Every policy that calls current_role() depends on its enum return type; drop them
-- here and recreate them against has_permission() below.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (coalesce(qual, '') ILIKE '%current_role%' OR coalesce(with_check, '') ILIKE '%current_role%'
           OR (schemaname = 'public' AND tablename = 'profiles'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.current_role();

ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.profiles ALTER COLUMN role TYPE text USING role::text;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'customer';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE RESTRICT;
UPDATE public.profiles p SET role_id = r.id FROM public.roles r WHERE r.key = p.role AND p.role_id IS NULL;
UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE key = 'customer'), role = 'customer' WHERE role_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN role_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);

-- ---------------------------------------------------------------------------
-- 3. Permission helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(p_user uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = p_user
      AND COALESCE(p.is_active, true)
      AND r.is_active
      AND (
        r.key = 'administrator'
        OR EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_key = p_key)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_permission(auth.uid(), p_key);
$$;

CREATE OR REPLACE FUNCTION public.has_any_permission(p_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM unnest(p_keys) k WHERE public.user_has_permission(auth.uid(), k));
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.key FROM public.permissions p WHERE public.user_has_permission(auth.uid(), p.key) ORDER BY p.key;
$$;

-- Active holders of a permission, for notifications. Administrators are included only when asked,
-- so finance alerts keep going to finance rather than to every administrator.
CREATE OR REPLACE FUNCTION public.permission_holders(p_key text, p_include_admin boolean DEFAULT true)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.roles r ON r.id = p.role_id
  WHERE COALESCE(p.is_active, true) AND r.is_active
    AND (
      (p_include_admin AND r.key = 'administrator')
      OR EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_key = p_key)
    );
$$;

-- A non-administrator may only hand out roles whose permissions they already hold.
CREATE OR REPLACE FUNCTION public.can_assign_role(p_actor uuid, p_role uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.user_has_permission(p_actor, 'users.manage') IS NOT TRUE THEN false
    WHEN (SELECT r.key FROM public.profiles p JOIN public.roles r ON r.id = p.role_id WHERE p.id = p_actor) = 'administrator' THEN true
    WHEN (SELECT key FROM public.roles WHERE id = p_role) = 'administrator' THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM public.role_permissions rp
      WHERE rp.role_id = p_role AND NOT public.user_has_permission(p_actor, rp.permission_key)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.require_permission(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_permission(p_key) THEN
    RAISE EXCEPTION 'You do not have permission: %', p_key USING ERRCODE = '42501';
  END IF;
END;
$$;

-- True when a row update touches columns outside p_allowed.
CREATE OR REPLACE FUNCTION public.changed_beyond(p_old jsonb, p_new jsonb, p_allowed text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (p_old - p_allowed) IS DISTINCT FROM (p_new - p_allowed);
$$;

-- Supabase grants new public functions to anon and authenticated by default, so revoke explicitly.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.current_role()',
    'public.user_has_permission(uuid, text)',
    'public.has_permission(text)',
    'public.has_any_permission(text[])',
    'public.my_permissions()',
    'public.permission_holders(text, boolean)',
    'public.can_assign_role(uuid, uuid)',
    'public.require_permission(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', fn);
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_permission(text) TO authenticated;
-- Policies evaluate these for anonymous readers too (for example company_info); they return false without a session.
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.has_permission(text) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.has_any_permission(text[]) TO anon, authenticated;
EXCEPTION WHEN undefined_object THEN
  GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.has_any_permission(text[]) TO authenticated;
END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.current_role() TO service_role;
  GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, text) TO service_role;
  GRANT EXECUTE ON FUNCTION public.permission_holders(text, boolean) TO service_role;
  GRANT EXECUTE ON FUNCTION public.can_assign_role(uuid, uuid) TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Guards: role sync and privilege escalation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_is_admin boolean;
  old_key text;
  new_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role_id IS NULL THEN
      SELECT id INTO NEW.role_id FROM public.roles WHERE key = COALESCE(NEW.role, 'customer');
      IF NEW.role_id IS NULL THEN
        RAISE EXCEPTION 'Unknown role %', NEW.role;
      END IF;
    END IF;
  ELSIF NEW.role_id IS NOT DISTINCT FROM OLD.role_id AND NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT id INTO NEW.role_id FROM public.roles WHERE key = NEW.role;
    IF NEW.role_id IS NULL THEN
      RAISE EXCEPTION 'Unknown role %', NEW.role;
    END IF;
  END IF;

  SELECT key INTO new_key FROM public.roles WHERE id = NEW.role_id;
  NEW.role := new_key;

  IF TG_OP = 'INSERT' OR actor IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role_id IS NOT DISTINCT FROM OLD.role_id AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  SELECT key INTO old_key FROM public.roles WHERE id = OLD.role_id;
  actor_is_admin := public.current_role() = 'administrator';

  IF NOT public.has_permission('users.manage') THEN
    RAISE EXCEPTION 'You do not have permission to change roles or account status' USING ERRCODE = '42501';
  END IF;
  IF NEW.id = actor THEN
    RAISE EXCEPTION 'You cannot change your own role or account status' USING ERRCODE = '42501';
  END IF;
  IF old_key = 'administrator' AND NOT actor_is_admin THEN
    RAISE EXCEPTION 'Only an administrator can change another administrator' USING ERRCODE = '42501';
  END IF;
  IF NEW.role_id IS DISTINCT FROM OLD.role_id AND NOT public.can_assign_role(actor, NEW.role_id) THEN
    RAISE EXCEPTION 'You cannot assign a role with permissions you do not hold' USING ERRCODE = '42501';
  END IF;
  IF old_key = 'administrator'
     AND (new_key <> 'administrator' OR NOT COALESCE(NEW.is_active, true))
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id <> NEW.id AND role = 'administrator' AND COALESCE(is_active, true)
     ) THEN
    RAISE EXCEPTION 'At least one active administrator must remain';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_profile_role ON public.profiles;
CREATE TRIGGER trigger_guard_profile_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

CREATE OR REPLACE FUNCTION public.guard_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'Built-in roles cannot be deleted; deactivate or edit them instead';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE role_id = OLD.id) THEN
      RAISE EXCEPTION 'Move every user off the % role before deleting it', OLD.name;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_system := false;
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.key IS DISTINCT FROM OLD.key THEN
    RAISE EXCEPTION 'A role key cannot change after it is created';
  END IF;
  IF NEW.is_system IS DISTINCT FROM OLD.is_system THEN
    RAISE EXCEPTION 'The built-in flag cannot change';
  END IF;
  IF OLD.key = 'administrator' AND NOT NEW.is_active THEN
    RAISE EXCEPTION 'The administrator role cannot be deactivated';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT NEW.is_active
     AND OLD.id = (SELECT role_id FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'You cannot deactivate your own role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_roles ON public.roles;
CREATE TRIGGER trigger_guard_roles
BEFORE INSERT OR UPDATE OR DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.guard_roles();

CREATE OR REPLACE FUNCTION public.guard_role_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := COALESCE(NEW.role_id, OLD.role_id);
  target_key text;
BEGIN
  SELECT key INTO target_key FROM public.roles WHERE id = target;
  IF target_key = 'administrator' THEN
    RAISE EXCEPTION 'The administrator role always has every permission';
  END IF;
  IF auth.uid() IS NULL OR public.current_role() = 'administrator' THEN
    IF TG_OP = 'INSERT' THEN NEW.granted_by := COALESCE(NEW.granted_by, auth.uid()); END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF target = (SELECT role_id FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'You cannot change permissions on your own role' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.has_permission(NEW.permission_key) THEN
      RAISE EXCEPTION 'You can only grant permissions you hold (%)', NEW.permission_key USING ERRCODE = '42501';
    END IF;
    NEW.granted_by := auth.uid();
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_role_permissions ON public.role_permissions;
CREATE TRIGGER trigger_guard_role_permissions
BEFORE INSERT OR UPDATE OR DELETE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.guard_role_permissions();

-- ---------------------------------------------------------------------------
-- 5. Guards: actions that a table-level policy cannot express
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_payment_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('confirmed', 'refunded') THEN
      PERFORM public.require_permission('payments.approve');
    ELSIF NEW.status = 'failed' THEN
      PERFORM public.require_permission('payments.reject');
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() = 1
     AND public.changed_beyond(to_jsonb(OLD), to_jsonb(NEW), ARRAY['status', 'paid_at']) THEN
    PERFORM public.require_permission('payments.edit');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_payment_actions ON public.payments;
CREATE TRIGGER trigger_guard_payment_actions
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_actions();

CREATE OR REPLACE FUNCTION public.guard_invoice_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trigger_guard_invoice_actions ON public.invoices;
CREATE TRIGGER trigger_guard_invoice_actions
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_actions();

CREATE OR REPLACE FUNCTION public.guard_quotation_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_role() = 'customer' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'sent' THEN
      PERFORM public.require_permission('quotations.submit');
    ELSIF NEW.status = 'accepted' THEN
      PERFORM public.require_permission('quotations.approve');
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.require_permission('quotations.reject');
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() = 1
     AND public.changed_beyond(to_jsonb(OLD), to_jsonb(NEW), ARRAY['status', 'updated_at']) THEN
    PERFORM public.require_permission('quotations.edit');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_quotation_actions ON public.quotations;
CREATE TRIGGER trigger_guard_quotation_actions
BEFORE INSERT OR UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.guard_quotation_actions();

CREATE OR REPLACE FUNCTION public.guard_purchase_order_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.approved_by IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.approved_by IS DISTINCT FROM OLD.approved_by))
     OR (NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status = 'draft')) THEN
    PERFORM public.require_permission('purchase_orders.approve');
  END IF;
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() = 1 AND public.current_role() IS DISTINCT FROM 'supplier'
     AND public.changed_beyond(to_jsonb(OLD), to_jsonb(NEW), ARRAY['status', 'approved_by']) THEN
    PERFORM public.require_permission('purchase_orders.edit');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_purchase_order_actions ON public.purchase_orders;
CREATE TRIGGER trigger_guard_purchase_order_actions
BEFORE INSERT OR UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_order_actions();

CREATE OR REPLACE FUNCTION public.guard_service_request_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_service_manager IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.assigned_service_manager END) THEN
    PERFORM public.require_permission('service_requests.assign');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_service_request_assignment ON public.service_requests;
CREATE TRIGGER trigger_guard_service_request_assignment
BEFORE INSERT OR UPDATE OF assigned_service_manager ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_service_request_assignment();

CREATE OR REPLACE FUNCTION public.guard_work_order_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id THEN
    PERFORM public.require_permission('work_orders.assign');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_work_order_assignment ON public.work_orders;
CREATE TRIGGER trigger_guard_work_order_assignment
BEFORE INSERT OR UPDATE OF assigned_to, supervisor_id ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_work_order_assignment();

-- ---------------------------------------------------------------------------
-- 6. Functions that used role lists
-- ---------------------------------------------------------------------------

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
    'customer'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = CURRENT_TIMESTAMP;
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
      holder,
      'low_stock',
      'Low stock: ' || NEW.name,
      'Stock for ' || NEW.name || ' (' || NEW.sku || ') is ' || NEW.quantity_on_hand || '. Reorder level: ' || NEW.reorder_level,
      jsonb_build_object('inventory_item_id', NEW.id, 'sku', NEW.sku)
    )
    FROM public.permission_holders('inventory.edit', true) AS holder;
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

    PERFORM public.notify_user(holder, 'payment', 'Payment confirmed',
      'Invoice payment of KES ' || NEW.amount || ' was confirmed.',
      jsonb_build_object('invoice_id', inv_id, 'payment_id', NEW.id))
    FROM public.permission_holders('payments.approve', false) AS holder;
  END IF;

  RETURN COALESCE(NEW, OLD);
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

-- ---------------------------------------------------------------------------
-- 7. Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles, public.role_permissions TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;

DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS roles_insert ON public.roles;
CREATE POLICY roles_insert ON public.roles FOR INSERT TO authenticated WITH CHECK ((SELECT public.has_permission('roles.manage')));
DROP POLICY IF EXISTS roles_update ON public.roles;
CREATE POLICY roles_update ON public.roles FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('roles.manage'))) WITH CHECK ((SELECT public.has_permission('roles.manage')));
DROP POLICY IF EXISTS roles_delete ON public.roles;
CREATE POLICY roles_delete ON public.roles FOR DELETE TO authenticated USING ((SELECT public.has_permission('roles.manage')));

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO authenticated USING (
  role_id = (SELECT role_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  OR (SELECT public.has_any_permission(ARRAY['roles.view', 'roles.manage', 'users.manage']))
);
DROP POLICY IF EXISTS role_permissions_insert ON public.role_permissions;
CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK ((SELECT public.has_permission('roles.manage')));
DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO authenticated USING ((SELECT public.has_permission('roles.manage')));

-- profiles
CREATE POLICY profiles_select_self_or_admin ON public.profiles FOR SELECT USING (
  id = (SELECT auth.uid()) OR (SELECT public.has_any_permission(ARRAY['directory.view', 'users.view', 'users.manage']))
);
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE
  USING ((SELECT public.has_permission('users.manage'))) WITH CHECK ((SELECT public.has_permission('users.manage')));

-- customers
CREATE POLICY customers_select_own_or_staff ON public.customers FOR SELECT
  USING (profile_id = (SELECT auth.uid()) OR (SELECT public.has_permission('customers.view')));
CREATE POLICY customers_insert_self_or_staff ON public.customers FOR INSERT
  WITH CHECK (profile_id = (SELECT auth.uid()) OR (SELECT public.has_permission('customers.create')));
CREATE POLICY customers_update_self_or_staff ON public.customers FOR UPDATE
  USING (profile_id = (SELECT auth.uid()) OR (SELECT public.has_permission('customers.edit')))
  WITH CHECK (profile_id = (SELECT auth.uid()) OR (SELECT public.has_permission('customers.edit')));
DROP POLICY IF EXISTS customers_staff_delete ON public.customers;
CREATE POLICY customers_staff_delete ON public.customers FOR DELETE USING ((SELECT public.has_permission('customers.delete')));

-- vessels
DROP POLICY IF EXISTS vessels_customer_own ON public.vessels;
DROP POLICY IF EXISTS vessels_select ON public.vessels;
CREATE POLICY vessels_select ON public.vessels FOR SELECT USING (
  customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())) OR (SELECT public.has_permission('vessels.view'))
);
DROP POLICY IF EXISTS vessels_insert ON public.vessels;
CREATE POLICY vessels_insert ON public.vessels FOR INSERT WITH CHECK (
  customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())) OR (SELECT public.has_permission('vessels.create'))
);
DROP POLICY IF EXISTS vessels_update ON public.vessels;
CREATE POLICY vessels_update ON public.vessels FOR UPDATE
  USING (customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())) OR (SELECT public.has_permission('vessels.edit')))
  WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())) OR (SELECT public.has_permission('vessels.edit')));
DROP POLICY IF EXISTS vessels_delete ON public.vessels;
CREATE POLICY vessels_delete ON public.vessels FOR DELETE USING (
  customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())) OR (SELECT public.has_permission('vessels.delete'))
);

-- service requests (customer and technician ownership policies are unchanged)
DROP POLICY IF EXISTS sr_staff_select ON public.service_requests;
CREATE POLICY sr_staff_select ON public.service_requests FOR SELECT USING ((SELECT public.has_permission('service_requests.view')));
DROP POLICY IF EXISTS sr_staff_insert ON public.service_requests;
CREATE POLICY sr_staff_insert ON public.service_requests FOR INSERT WITH CHECK ((SELECT public.has_permission('service_requests.create')));
DROP POLICY IF EXISTS sr_staff_update ON public.service_requests;
CREATE POLICY sr_staff_update ON public.service_requests FOR UPDATE
  USING ((SELECT public.has_permission('service_requests.edit'))) WITH CHECK ((SELECT public.has_permission('service_requests.edit')));
DROP POLICY IF EXISTS sr_staff_delete ON public.service_requests;
CREATE POLICY sr_staff_delete ON public.service_requests FOR DELETE USING ((SELECT public.has_permission('service_requests.delete')));

CREATE POLICY srh_participants ON public.service_request_status_history FOR SELECT USING (
  service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
  OR service_request_id IN (SELECT service_request_id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
  OR (SELECT public.has_permission('service_requests.view'))
);
CREATE POLICY srh_staff_insert ON public.service_request_status_history FOR INSERT WITH CHECK (
  changed_by = (SELECT auth.uid())
  AND (
    service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
    OR service_request_id IN (SELECT service_request_id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
    OR (SELECT public.has_permission('service_requests.edit'))
  )
);

CREATE POLICY sra_participants ON public.service_request_attachments FOR SELECT USING (
  service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
  OR service_request_id IN (SELECT service_request_id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
  OR (SELECT public.has_permission('service_requests.view'))
);
CREATE POLICY sra_upload ON public.service_request_attachments FOR INSERT WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND (
    service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
    OR service_request_id IN (SELECT service_request_id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
    OR (SELECT public.has_permission('service_requests.edit'))
  )
);

-- work orders
DROP POLICY IF EXISTS wo_staff_select ON public.work_orders;
CREATE POLICY wo_staff_select ON public.work_orders FOR SELECT USING ((SELECT public.has_permission('work_orders.view')));
DROP POLICY IF EXISTS wo_staff_insert ON public.work_orders;
CREATE POLICY wo_staff_insert ON public.work_orders FOR INSERT WITH CHECK ((SELECT public.has_permission('work_orders.create')));
DROP POLICY IF EXISTS wo_staff_update ON public.work_orders;
CREATE POLICY wo_staff_update ON public.work_orders FOR UPDATE
  USING ((SELECT public.has_permission('work_orders.edit'))) WITH CHECK ((SELECT public.has_permission('work_orders.edit')));
DROP POLICY IF EXISTS wo_staff_delete ON public.work_orders;
CREATE POLICY wo_staff_delete ON public.work_orders FOR DELETE USING ((SELECT public.has_permission('work_orders.delete')));

CREATE POLICY wom_participants ON public.work_order_media FOR SELECT USING (
  work_order_id IN (SELECT id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()) OR supervisor_id = (SELECT auth.uid()))
  OR (SELECT public.has_permission('work_orders.view'))
);
CREATE POLICY wom_upload ON public.work_order_media FOR INSERT WITH CHECK (
  uploaded_by = (SELECT auth.uid())
  AND (
    work_order_id IN (SELECT id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()) OR supervisor_id = (SELECT auth.uid()))
    OR (SELECT public.has_permission('work_orders.edit'))
  )
);

CREATE POLICY wop_read ON public.work_order_parts FOR SELECT USING (
  work_order_id IN (SELECT id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()) OR supervisor_id = (SELECT auth.uid()))
  OR (SELECT public.has_permission('work_order_parts.view'))
);
DROP POLICY IF EXISTS wop_staff_insert ON public.work_order_parts;
CREATE POLICY wop_staff_insert ON public.work_order_parts FOR INSERT WITH CHECK ((SELECT public.has_permission('work_order_parts.manage')));
DROP POLICY IF EXISTS wop_staff_update ON public.work_order_parts;
CREATE POLICY wop_staff_update ON public.work_order_parts FOR UPDATE
  USING ((SELECT public.has_permission('work_order_parts.manage'))) WITH CHECK ((SELECT public.has_permission('work_order_parts.manage')));
DROP POLICY IF EXISTS wop_staff_delete ON public.work_order_parts;
CREATE POLICY wop_staff_delete ON public.work_order_parts FOR DELETE USING ((SELECT public.has_permission('work_order_parts.manage')));

-- quotations
DROP POLICY IF EXISTS q_staff_select ON public.quotations;
CREATE POLICY q_staff_select ON public.quotations FOR SELECT USING ((SELECT public.has_permission('quotations.view')));
DROP POLICY IF EXISTS q_staff_insert ON public.quotations;
CREATE POLICY q_staff_insert ON public.quotations FOR INSERT WITH CHECK ((SELECT public.has_permission('quotations.create')));
DROP POLICY IF EXISTS q_staff_update ON public.quotations;
CREATE POLICY q_staff_update ON public.quotations FOR UPDATE
  USING ((SELECT public.has_any_permission(ARRAY['quotations.edit', 'quotations.submit', 'quotations.approve', 'quotations.reject'])))
  WITH CHECK ((SELECT public.has_any_permission(ARRAY['quotations.edit', 'quotations.submit', 'quotations.approve', 'quotations.reject'])));
DROP POLICY IF EXISTS q_staff_delete ON public.quotations;
CREATE POLICY q_staff_delete ON public.quotations FOR DELETE USING ((SELECT public.has_permission('quotations.delete')));

CREATE POLICY q_customer_respond ON public.quotations FOR UPDATE
USING (
  public.current_role() = 'customer'
  AND status = 'sent'
  AND service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
)
WITH CHECK (
  public.current_role() = 'customer'
  AND status IN ('accepted', 'rejected')
  AND service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
);

CREATE POLICY qi_read ON public.quotation_items FOR SELECT USING (
  quotation_id IN (SELECT id FROM public.quotations WHERE service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid()))))
  OR (SELECT public.has_permission('quotations.view'))
);
DROP POLICY IF EXISTS qi_insert ON public.quotation_items;
CREATE POLICY qi_insert ON public.quotation_items FOR INSERT WITH CHECK ((SELECT public.has_any_permission(ARRAY['quotations.create', 'quotations.edit'])));
DROP POLICY IF EXISTS qi_update ON public.quotation_items;
CREATE POLICY qi_update ON public.quotation_items FOR UPDATE
  USING ((SELECT public.has_permission('quotations.edit'))) WITH CHECK ((SELECT public.has_permission('quotations.edit')));
DROP POLICY IF EXISTS qi_delete ON public.quotation_items;
CREATE POLICY qi_delete ON public.quotation_items FOR DELETE USING ((SELECT public.has_permission('quotations.edit')));

-- invoices and payments (customer policies are unchanged)
DROP POLICY IF EXISTS inv_staff_select ON public.invoices;
CREATE POLICY inv_staff_select ON public.invoices FOR SELECT USING ((SELECT public.has_permission('invoices.view')));
DROP POLICY IF EXISTS inv_staff_insert ON public.invoices;
CREATE POLICY inv_staff_insert ON public.invoices FOR INSERT WITH CHECK ((SELECT public.has_permission('invoices.create')));
DROP POLICY IF EXISTS inv_staff_update ON public.invoices;
CREATE POLICY inv_staff_update ON public.invoices FOR UPDATE
  USING ((SELECT public.has_any_permission(ARRAY['invoices.edit', 'invoices.approve', 'invoices.reject'])))
  WITH CHECK ((SELECT public.has_any_permission(ARRAY['invoices.edit', 'invoices.approve', 'invoices.reject'])));
DROP POLICY IF EXISTS inv_staff_delete ON public.invoices;
CREATE POLICY inv_staff_delete ON public.invoices FOR DELETE USING ((SELECT public.has_permission('invoices.delete')));

DROP POLICY IF EXISTS pay_staff_select ON public.payments;
CREATE POLICY pay_staff_select ON public.payments FOR SELECT USING ((SELECT public.has_permission('payments.view')));
DROP POLICY IF EXISTS pay_staff_insert ON public.payments;
CREATE POLICY pay_staff_insert ON public.payments FOR INSERT WITH CHECK ((SELECT public.has_permission('payments.create')));
DROP POLICY IF EXISTS pay_staff_update ON public.payments;
CREATE POLICY pay_staff_update ON public.payments FOR UPDATE
  USING ((SELECT public.has_any_permission(ARRAY['payments.edit', 'payments.approve', 'payments.reject'])))
  WITH CHECK ((SELECT public.has_any_permission(ARRAY['payments.edit', 'payments.approve', 'payments.reject'])));
DROP POLICY IF EXISTS pay_staff_delete ON public.payments;
CREATE POLICY pay_staff_delete ON public.payments FOR DELETE USING ((SELECT public.has_permission('payments.delete')));

-- inventory
CREATE POLICY inv_items_staff_read ON public.inventory_items FOR SELECT USING ((SELECT public.has_permission('inventory.view')));
DROP POLICY IF EXISTS inv_items_insert ON public.inventory_items;
CREATE POLICY inv_items_insert ON public.inventory_items FOR INSERT WITH CHECK ((SELECT public.has_permission('inventory.create')));
DROP POLICY IF EXISTS inv_items_update ON public.inventory_items;
CREATE POLICY inv_items_update ON public.inventory_items FOR UPDATE
  USING ((SELECT public.has_permission('inventory.edit'))) WITH CHECK ((SELECT public.has_permission('inventory.edit')));
DROP POLICY IF EXISTS inv_items_delete ON public.inventory_items;
CREATE POLICY inv_items_delete ON public.inventory_items FOR DELETE USING ((SELECT public.has_permission('inventory.delete')));

CREATE POLICY ic_staff_read ON public.inventory_categories FOR SELECT USING ((SELECT public.has_permission('inventory.view')));
DROP POLICY IF EXISTS ic_insert ON public.inventory_categories;
CREATE POLICY ic_insert ON public.inventory_categories FOR INSERT WITH CHECK ((SELECT public.has_permission('inventory.create')));
DROP POLICY IF EXISTS ic_update ON public.inventory_categories;
CREATE POLICY ic_update ON public.inventory_categories FOR UPDATE
  USING ((SELECT public.has_permission('inventory.edit'))) WITH CHECK ((SELECT public.has_permission('inventory.edit')));
DROP POLICY IF EXISTS ic_delete ON public.inventory_categories;
CREATE POLICY ic_delete ON public.inventory_categories FOR DELETE USING ((SELECT public.has_permission('inventory.delete')));

DROP POLICY IF EXISTS sm_select ON public.stock_movements;
CREATE POLICY sm_select ON public.stock_movements FOR SELECT USING ((SELECT public.has_permission('stock_movements.view')));
DROP POLICY IF EXISTS sm_insert ON public.stock_movements;
CREATE POLICY sm_insert ON public.stock_movements FOR INSERT WITH CHECK ((SELECT public.has_permission('stock_movements.create')));
DROP POLICY IF EXISTS sm_update ON public.stock_movements;
CREATE POLICY sm_update ON public.stock_movements FOR UPDATE
  USING ((SELECT public.has_permission('stock_movements.edit'))) WITH CHECK ((SELECT public.has_permission('stock_movements.edit')));
DROP POLICY IF EXISTS sm_delete ON public.stock_movements;
CREATE POLICY sm_delete ON public.stock_movements FOR DELETE USING ((SELECT public.has_permission('stock_movements.delete')));

-- suppliers and purchase orders
DROP POLICY IF EXISTS sup_select ON public.suppliers;
CREATE POLICY sup_select ON public.suppliers FOR SELECT USING ((SELECT public.has_permission('suppliers.view')));
DROP POLICY IF EXISTS sup_insert ON public.suppliers;
CREATE POLICY sup_insert ON public.suppliers FOR INSERT WITH CHECK ((SELECT public.has_permission('suppliers.create')));
DROP POLICY IF EXISTS sup_update ON public.suppliers;
CREATE POLICY sup_update ON public.suppliers FOR UPDATE
  USING ((SELECT public.has_permission('suppliers.edit'))) WITH CHECK ((SELECT public.has_permission('suppliers.edit')));
DROP POLICY IF EXISTS sup_delete ON public.suppliers;
CREATE POLICY sup_delete ON public.suppliers FOR DELETE USING ((SELECT public.has_permission('suppliers.delete')));
DROP POLICY IF EXISTS sup_supplier_self ON public.suppliers;
CREATE POLICY sup_supplier_self ON public.suppliers FOR SELECT
  USING (profile_id = (SELECT auth.uid()) AND (SELECT public.has_permission('purchase_orders.view_own')));

DROP POLICY IF EXISTS po_staff_select ON public.purchase_orders;
CREATE POLICY po_staff_select ON public.purchase_orders FOR SELECT USING ((SELECT public.has_permission('purchase_orders.view')));
DROP POLICY IF EXISTS po_staff_insert ON public.purchase_orders;
CREATE POLICY po_staff_insert ON public.purchase_orders FOR INSERT WITH CHECK ((SELECT public.has_permission('purchase_orders.create')));
DROP POLICY IF EXISTS po_staff_update ON public.purchase_orders;
CREATE POLICY po_staff_update ON public.purchase_orders FOR UPDATE
  USING ((SELECT public.has_any_permission(ARRAY['purchase_orders.edit', 'purchase_orders.approve'])))
  WITH CHECK ((SELECT public.has_any_permission(ARRAY['purchase_orders.edit', 'purchase_orders.approve'])));
DROP POLICY IF EXISTS po_staff_delete ON public.purchase_orders;
CREATE POLICY po_staff_delete ON public.purchase_orders FOR DELETE USING ((SELECT public.has_permission('purchase_orders.delete')));
DROP POLICY IF EXISTS po_supplier_own ON public.purchase_orders;
CREATE POLICY po_supplier_own ON public.purchase_orders FOR SELECT USING (
  supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = (SELECT auth.uid()))
  AND (SELECT public.has_permission('purchase_orders.view_own'))
);
DROP POLICY IF EXISTS po_supplier_update ON public.purchase_orders;
CREATE POLICY po_supplier_update ON public.purchase_orders FOR UPDATE
  USING (supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = (SELECT auth.uid())) AND (SELECT public.has_permission('purchase_orders.edit_own')))
  WITH CHECK (supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = (SELECT auth.uid())) AND (SELECT public.has_permission('purchase_orders.edit_own')));

CREATE POLICY poi_read ON public.purchase_order_items FOR SELECT USING (
  (SELECT public.has_permission('purchase_orders.view'))
  OR (
    purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE supplier_id IN (SELECT id FROM public.suppliers WHERE profile_id = (SELECT auth.uid())))
    AND (SELECT public.has_permission('purchase_orders.view_own'))
  )
);
DROP POLICY IF EXISTS poi_insert ON public.purchase_order_items;
CREATE POLICY poi_insert ON public.purchase_order_items FOR INSERT WITH CHECK ((SELECT public.has_any_permission(ARRAY['purchase_orders.create', 'purchase_orders.edit'])));
DROP POLICY IF EXISTS poi_update ON public.purchase_order_items;
CREATE POLICY poi_update ON public.purchase_order_items FOR UPDATE
  USING ((SELECT public.has_permission('purchase_orders.edit'))) WITH CHECK ((SELECT public.has_permission('purchase_orders.edit')));
DROP POLICY IF EXISTS poi_delete ON public.purchase_order_items;
CREATE POLICY poi_delete ON public.purchase_order_items FOR DELETE USING ((SELECT public.has_permission('purchase_orders.edit')));

-- feedback, messages, appointments, company, audit
CREATE POLICY fb_staff_read ON public.feedback FOR SELECT USING ((SELECT public.has_permission('feedback.view')));
CREATE POLICY fb_staff_respond ON public.feedback FOR UPDATE
  USING ((SELECT public.has_permission('feedback.edit'))) WITH CHECK ((SELECT public.has_permission('feedback.edit')));

CREATE POLICY msg_participants ON public.messages FOR SELECT USING (
  service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
  OR service_request_id IN (SELECT service_request_id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
  OR (SELECT public.has_permission('messages.view'))
);
CREATE POLICY msg_participants_insert ON public.messages FOR INSERT WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND (
    service_request_id IN (SELECT id FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid())))
    OR service_request_id IN (SELECT service_request_id FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
    OR (SELECT public.has_permission('messages.create'))
  )
);

DROP POLICY IF EXISTS appt_select ON public.appointments;
CREATE POLICY appt_select ON public.appointments FOR SELECT USING ((SELECT public.has_permission('appointments.view')));
DROP POLICY IF EXISTS appt_insert ON public.appointments;
CREATE POLICY appt_insert ON public.appointments FOR INSERT WITH CHECK ((SELECT public.has_permission('appointments.create')));
DROP POLICY IF EXISTS appt_update ON public.appointments;
CREATE POLICY appt_update ON public.appointments FOR UPDATE
  USING ((SELECT public.has_permission('appointments.edit'))) WITH CHECK ((SELECT public.has_permission('appointments.edit')));
DROP POLICY IF EXISTS appt_delete ON public.appointments;
CREATE POLICY appt_delete ON public.appointments FOR DELETE USING ((SELECT public.has_permission('appointments.delete')));

CREATE POLICY company_write_admin ON public.company_info FOR ALL
  USING ((SELECT public.has_permission('company.edit'))) WITH CHECK ((SELECT public.has_permission('company.edit')));

CREATE POLICY audit_admin_read ON public.audit_logs FOR SELECT USING ((SELECT public.has_permission('audit.view')));

-- storage
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage schema absent; bucket policies skipped';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS vessel_photos_read ON storage.objects';
  EXECUTE $p$CREATE POLICY vessel_photos_read ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'vessel-photos' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.customers WHERE profile_id = (SELECT auth.uid()))
        OR (SELECT public.has_permission('vessels.view'))
      )
    )$p$;
  EXECUTE $p$CREATE POLICY vessel_photos_rw ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'vessel-photos' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.customers WHERE profile_id = (SELECT auth.uid()))
        OR (SELECT public.has_permission('vessels.edit'))
      )
    )
    WITH CHECK (
      bucket_id = 'vessel-photos' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.customers WHERE profile_id = (SELECT auth.uid()))
        OR (SELECT public.has_permission('vessels.edit'))
      )
    )$p$;

  EXECUTE 'DROP POLICY IF EXISTS service_attachments_read ON storage.objects';
  EXECUTE $p$CREATE POLICY service_attachments_read ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'service-attachments' AND (
        (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid()))
        )
        OR (storage.foldername(name))[1] IN (SELECT service_request_id::text FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
        OR (SELECT public.has_permission('service_requests.view'))
      )
    )$p$;
  EXECUTE $p$CREATE POLICY service_attachments_rw ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'service-attachments' AND (
        (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid()))
        )
        OR (storage.foldername(name))[1] IN (SELECT service_request_id::text FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
        OR (SELECT public.has_permission('service_requests.edit'))
      )
    )
    WITH CHECK (
      bucket_id = 'service-attachments' AND (
        (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.service_requests WHERE customer_id IN (SELECT id FROM public.customers WHERE profile_id = (SELECT auth.uid()))
        )
        OR (storage.foldername(name))[1] IN (SELECT service_request_id::text FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()))
        OR (SELECT public.has_permission('service_requests.edit'))
      )
    )$p$;

  EXECUTE 'DROP POLICY IF EXISTS work_order_media_read ON storage.objects';
  EXECUTE $p$CREATE POLICY work_order_media_read ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'work-order-media' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()) OR supervisor_id = (SELECT auth.uid()))
        OR (SELECT public.has_permission('work_orders.view'))
      )
    )$p$;
  EXECUTE $p$CREATE POLICY work_order_media_rw ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'work-order-media' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()) OR supervisor_id = (SELECT auth.uid()))
        OR (SELECT public.has_permission('work_orders.edit'))
      )
    )
    WITH CHECK (
      bucket_id = 'work-order-media' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.work_orders WHERE assigned_to = (SELECT auth.uid()) OR supervisor_id = (SELECT auth.uid()))
        OR (SELECT public.has_permission('work_orders.edit'))
      )
    )$p$;

  EXECUTE $p$CREATE POLICY pdf_buckets_staff ON storage.objects FOR ALL TO authenticated
    USING (
      (bucket_id = 'quotation-pdfs' AND (SELECT public.has_permission('quotations.print')))
      OR (bucket_id = 'invoice-pdfs' AND (SELECT public.has_permission('invoices.print')))
      OR (bucket_id = 'reports' AND (SELECT public.has_any_permission(ARRAY['service_requests.view_reports', 'invoices.view_reports', 'inventory.view_reports'])))
    )
    WITH CHECK (
      (bucket_id = 'quotation-pdfs' AND (SELECT public.has_permission('quotations.print')))
      OR (bucket_id = 'invoice-pdfs' AND (SELECT public.has_permission('invoices.print')))
      OR (bucket_id = 'reports' AND (SELECT public.has_any_permission(ARRAY['service_requests.view_reports', 'invoices.view_reports', 'inventory.view_reports'])))
    )$p$;
END $$;
