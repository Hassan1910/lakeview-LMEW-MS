-- Row Level Security (RLS) Policies for LMEW Management System

-- 1. Enable RLS on all relational tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_request_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS work_order_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_info ENABLE ROW LEVEL SECURITY;

-- 2. Specific Security Policies
DROP POLICY IF EXISTS profiles_select_self_or_admin ON profiles;
CREATE POLICY profiles_select_self_or_admin ON profiles FOR SELECT USING (id = auth.uid() OR public.current_role() IN ('administrator','service_manager','receptionist','supervisor'));

DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS customers_select_own_or_staff ON customers;
CREATE POLICY customers_select_own_or_staff ON customers FOR SELECT USING (profile_id = auth.uid() OR public.current_role() IN ('administrator','service_manager','finance_manager','receptionist'));

DROP POLICY IF EXISTS customers_insert_self_or_staff ON customers;
CREATE POLICY customers_insert_self_or_staff ON customers FOR INSERT WITH CHECK (profile_id = auth.uid() OR public.current_role() IN ('administrator','receptionist'));

DROP POLICY IF EXISTS vessels_customer_own ON vessels;
CREATE POLICY vessels_customer_own ON vessels FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()) OR public.current_role() IN ('administrator','service_manager','technician','supervisor'));

DROP POLICY IF EXISTS sr_customer_own ON service_requests;
CREATE POLICY sr_customer_own ON service_requests FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS sr_customer_create ON service_requests;
CREATE POLICY sr_customer_create ON service_requests FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS sr_staff_all ON service_requests;
CREATE POLICY sr_staff_all ON service_requests FOR ALL USING (public.current_role() IN ('administrator','service_manager','supervisor','finance_manager'));

DROP POLICY IF EXISTS sr_technician_assigned ON service_requests;
CREATE POLICY sr_technician_assigned ON service_requests FOR SELECT USING (id IN (SELECT service_request_id FROM work_orders WHERE assigned_to = auth.uid()));

DROP POLICY IF EXISTS wo_technician_own ON work_orders;
CREATE POLICY wo_technician_own ON work_orders FOR SELECT USING (assigned_to = auth.uid() OR supervisor_id = auth.uid());

DROP POLICY IF EXISTS wo_technician_update_status ON work_orders;
CREATE POLICY wo_technician_update_status ON work_orders FOR UPDATE USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

DROP POLICY IF EXISTS wo_service_manager_all ON work_orders;
CREATE POLICY wo_service_manager_all ON work_orders FOR ALL USING (public.current_role() IN ('administrator','service_manager','supervisor'));

DROP POLICY IF EXISTS q_customer_own ON quotations;
CREATE POLICY q_customer_own ON quotations FOR SELECT USING (service_request_id IN (SELECT id FROM service_requests WHERE customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())));

DROP POLICY IF EXISTS q_staff_manage ON quotations;
CREATE POLICY q_staff_manage ON quotations FOR ALL USING (public.current_role() IN ('administrator','service_manager','finance_manager'));

DROP POLICY IF EXISTS inv_customer_own ON invoices;
CREATE POLICY inv_customer_own ON invoices FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS inv_finance_manage ON invoices;
CREATE POLICY inv_finance_manage ON invoices FOR ALL USING (public.current_role() IN ('administrator','finance_manager'));

DROP POLICY IF EXISTS pay_customer_own ON payments;
CREATE POLICY pay_customer_own ON payments FOR SELECT USING (invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())));

DROP POLICY IF EXISTS pay_customer_create ON payments;
CREATE POLICY pay_customer_create ON payments FOR INSERT WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())));

DROP POLICY IF EXISTS pay_finance_manage ON payments;
CREATE POLICY pay_finance_manage ON payments FOR ALL USING (public.current_role() IN ('administrator','finance_manager'));

DROP POLICY IF EXISTS inv_items_staff_read ON inventory_items;
CREATE POLICY inv_items_staff_read ON inventory_items FOR SELECT USING (public.current_role() IN ('administrator','store_manager','procurement_officer','service_manager','technician','finance_manager','receptionist'));

DROP POLICY IF EXISTS inv_items_store_write ON inventory_items;
CREATE POLICY inv_items_store_write ON inventory_items FOR ALL USING (public.current_role() IN ('administrator','store_manager'));

DROP POLICY IF EXISTS sm_store_all ON stock_movements;
CREATE POLICY sm_store_all ON stock_movements FOR ALL USING (public.current_role() IN ('administrator','store_manager','procurement_officer'));

DROP POLICY IF EXISTS sup_procurement_all ON suppliers;
CREATE POLICY sup_procurement_all ON suppliers FOR ALL USING (public.current_role() IN ('administrator','procurement_officer','store_manager'));

DROP POLICY IF EXISTS sup_supplier_self ON suppliers;
CREATE POLICY sup_supplier_self ON suppliers FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS po_procurement_all ON purchase_orders;
CREATE POLICY po_procurement_all ON purchase_orders FOR ALL USING (public.current_role() IN ('administrator','procurement_officer','store_manager'));

DROP POLICY IF EXISTS po_supplier_own ON purchase_orders;
CREATE POLICY po_supplier_own ON purchase_orders FOR SELECT USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS fb_customer_own ON feedback;
CREATE POLICY fb_customer_own ON feedback FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS fb_staff_read ON feedback;
CREATE POLICY fb_staff_read ON feedback FOR SELECT USING (public.current_role() IN ('administrator','service_manager','supervisor'));

DROP POLICY IF EXISTS notif_own ON notifications;
CREATE POLICY notif_own ON notifications FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS msg_participants ON messages;
CREATE POLICY msg_participants ON messages FOR SELECT USING (service_request_id IN (SELECT id FROM service_requests WHERE customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid())) OR public.current_role() IN ('administrator','service_manager','supervisor') OR service_request_id IN (SELECT service_request_id FROM work_orders WHERE assigned_to = auth.uid()));

DROP POLICY IF EXISTS msg_participants_insert ON messages;
CREATE POLICY msg_participants_insert ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS company_read_all ON company_info;
CREATE POLICY company_read_all ON company_info FOR SELECT USING (true);

DROP POLICY IF EXISTS company_write_admin ON company_info;
CREATE POLICY company_write_admin ON company_info FOR ALL USING (public.current_role() = 'administrator');

DROP POLICY IF EXISTS audit_admin_read ON audit_logs;
CREATE POLICY audit_admin_read ON audit_logs FOR SELECT USING (public.current_role() = 'administrator');

ALTER TABLE IF EXISTS work_order_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wop_read ON work_order_parts;
CREATE POLICY wop_read ON work_order_parts FOR SELECT USING (
  work_order_id IN (SELECT id FROM work_orders WHERE assigned_to = auth.uid() OR supervisor_id = auth.uid())
  OR public.current_role() IN ('administrator','service_manager','store_manager','supervisor')
);

DROP POLICY IF EXISTS wop_technician_insert ON work_order_parts;
CREATE POLICY wop_technician_insert ON work_order_parts FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND work_order_id IN (SELECT id FROM work_orders WHERE assigned_to = auth.uid())
);

DROP POLICY IF EXISTS wop_store_all ON work_order_parts;
CREATE POLICY wop_store_all ON work_order_parts FOR ALL USING (
  public.current_role() IN ('administrator','store_manager','service_manager')
);

DROP POLICY IF EXISTS profiles_admin_update ON profiles;
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE
  USING (public.current_role() = 'administrator')
  WITH CHECK (public.current_role() = 'administrator');

DROP POLICY IF EXISTS customers_update_self_or_staff ON customers;
CREATE POLICY customers_update_self_or_staff ON customers FOR UPDATE
  USING (profile_id = auth.uid() OR public.current_role() IN ('administrator','receptionist'))
  WITH CHECK (profile_id = auth.uid() OR public.current_role() IN ('administrator','receptionist'));
