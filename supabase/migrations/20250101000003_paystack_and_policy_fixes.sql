-- LMEW-MS Migration: Paystack payment method + schema alignment fixes
-- Run after: 20250101000002_rls_policies.sql

-- 1. Add 'paystack' to the payment_method enum
--    (Kept Paystack gateway by project decision)
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'paystack';

-- 2. Add push_token column to profiles so Edge Functions can send Expo push notifications
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- 3. Add SELECT policy for service_request_status_history (was missing in rls_policies.sql)
DROP POLICY IF EXISTS srh_participants ON service_request_status_history;
CREATE POLICY srh_participants ON service_request_status_history
  FOR SELECT USING (
    service_request_id IN (
      SELECT id FROM service_requests WHERE customer_id IN (
        SELECT id FROM customers WHERE profile_id = auth.uid()
      )
    )
    OR public.current_role() IN ('administrator','service_manager','supervisor','finance_manager','technician')
  );

-- 4. Add SELECT policy for service_request_attachments
DROP POLICY IF EXISTS sra_participants ON service_request_attachments;
CREATE POLICY sra_participants ON service_request_attachments
  FOR SELECT USING (
    service_request_id IN (
      SELECT id FROM service_requests WHERE customer_id IN (
        SELECT id FROM customers WHERE profile_id = auth.uid()
      )
    )
    OR public.current_role() IN ('administrator','service_manager','supervisor','technician')
  );

DROP POLICY IF EXISTS sra_upload ON service_request_attachments;
CREATE POLICY sra_upload ON service_request_attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- 5. Add INSERT policy for service_request_status_history (staff only)
DROP POLICY IF EXISTS srh_staff_insert ON service_request_status_history;
CREATE POLICY srh_staff_insert ON service_request_status_history
  FOR INSERT WITH CHECK (
    public.current_role() IN ('administrator','service_manager','supervisor','technician')
    OR changed_by = auth.uid()
  );

-- 6. Add SELECT/INSERT policies for work_order_media
DROP POLICY IF EXISTS wom_participants ON work_order_media;
CREATE POLICY wom_participants ON work_order_media
  FOR SELECT USING (
    work_order_id IN (
      SELECT id FROM work_orders WHERE assigned_to = auth.uid() OR supervisor_id = auth.uid()
    )
    OR public.current_role() IN ('administrator','service_manager','supervisor')
  );

DROP POLICY IF EXISTS wom_upload ON work_order_media;
CREATE POLICY wom_upload ON work_order_media
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- 7. Add SELECT/INSERT for quotation_items
DROP POLICY IF EXISTS qi_read ON quotation_items;
CREATE POLICY qi_read ON quotation_items
  FOR SELECT USING (
    quotation_id IN (
      SELECT id FROM quotations WHERE service_request_id IN (
        SELECT id FROM service_requests WHERE customer_id IN (
          SELECT id FROM customers WHERE profile_id = auth.uid()
        )
      )
    )
    OR public.current_role() IN ('administrator','service_manager','finance_manager')
  );

DROP POLICY IF EXISTS qi_write ON quotation_items;
CREATE POLICY qi_write ON quotation_items
  FOR ALL USING (public.current_role() IN ('administrator','service_manager','finance_manager'));

-- 8. Add policies for purchase_order_items
DROP POLICY IF EXISTS poi_read ON purchase_order_items;
CREATE POLICY poi_read ON purchase_order_items
  FOR SELECT USING (public.current_role() IN ('administrator','procurement_officer','store_manager'));

DROP POLICY IF EXISTS poi_write ON purchase_order_items;
CREATE POLICY poi_write ON purchase_order_items
  FOR ALL USING (public.current_role() IN ('administrator','procurement_officer','store_manager'));
