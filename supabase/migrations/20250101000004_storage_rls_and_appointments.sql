-- Storage buckets, tighter RLS, appointments, and realtime publication.

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appt_receptionist_all ON appointments;
CREATE POLICY appt_receptionist_all ON appointments FOR ALL
  USING (public.current_role() IN ('administrator','receptionist','service_manager'))
  WITH CHECK (public.current_role() IN ('administrator','receptionist','service_manager'));

DROP POLICY IF EXISTS appt_customer_read ON appointments;
CREATE POLICY appt_customer_read ON appointments FOR SELECT
  USING (customer_id IN (SELECT id FROM customers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS profiles_update_self ON profiles;
CREATE POLICY profiles_update_self ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = public.current_role());

DROP POLICY IF EXISTS ic_staff_read ON inventory_categories;
CREATE POLICY ic_staff_read ON inventory_categories FOR SELECT
  USING (public.current_role() IN ('administrator','store_manager','procurement_officer','service_manager','technician','finance_manager','receptionist'));

DROP POLICY IF EXISTS ic_store_write ON inventory_categories;
CREATE POLICY ic_store_write ON inventory_categories FOR ALL
  USING (public.current_role() IN ('administrator','store_manager'))
  WITH CHECK (public.current_role() IN ('administrator','store_manager'));

DROP POLICY IF EXISTS sr_receptionist_all ON service_requests;
CREATE POLICY sr_receptionist_all ON service_requests FOR ALL
  USING (public.current_role() = 'receptionist')
  WITH CHECK (public.current_role() = 'receptionist');

DROP POLICY IF EXISTS fb_staff_respond ON feedback;
CREATE POLICY fb_staff_respond ON feedback FOR UPDATE
  USING (public.current_role() IN ('administrator','service_manager'))
  WITH CHECK (public.current_role() IN ('administrator','service_manager'));

DROP POLICY IF EXISTS po_supplier_update ON purchase_orders;
CREATE POLICY po_supplier_update ON purchase_orders FOR UPDATE
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()))
  WITH CHECK (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_guard_supplier_po ON purchase_orders;
CREATE TRIGGER trigger_guard_supplier_po
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_po_update();

DROP POLICY IF EXISTS msg_participants_insert ON messages;
CREATE POLICY msg_participants_insert ON messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND (
    service_request_id IN (
      SELECT id FROM service_requests WHERE customer_id IN (
        SELECT id FROM customers WHERE profile_id = auth.uid()
      )
    )
    OR public.current_role() IN ('administrator','service_manager','supervisor','receptionist')
    OR service_request_id IN (SELECT service_request_id FROM work_orders WHERE assigned_to = auth.uid())
  )
);

DROP POLICY IF EXISTS sra_upload ON service_request_attachments;
CREATE POLICY sra_upload ON service_request_attachments FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    service_request_id IN (
      SELECT id FROM service_requests WHERE customer_id IN (
        SELECT id FROM customers WHERE profile_id = auth.uid()
      )
    )
    OR public.current_role() IN ('administrator','service_manager','supervisor','technician','receptionist')
  )
);

DROP POLICY IF EXISTS wom_upload ON work_order_media;
CREATE POLICY wom_upload ON work_order_media FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    work_order_id IN (
      SELECT id FROM work_orders WHERE assigned_to = auth.uid() OR supervisor_id = auth.uid()
    )
    OR public.current_role() IN ('administrator','service_manager')
  )
);

DROP POLICY IF EXISTS srh_staff_insert ON service_request_status_history;
CREATE POLICY srh_staff_insert ON service_request_status_history FOR INSERT WITH CHECK (
  changed_by = auth.uid()
  AND (
    public.current_role() IN ('administrator','service_manager','supervisor','technician')
    OR service_request_id IN (
      SELECT id FROM service_requests WHERE customer_id IN (
        SELECT id FROM customers WHERE profile_id = auth.uid()
      )
    )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON appointments, work_order_parts TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY['service_requests','notifications','work_orders','payments','inventory_items','messages']
    LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END;
    END LOOP;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'storage schema absent; bucket policies skipped';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public)
  VALUES
    ('avatars', 'avatars', true),
    ('vessel-photos', 'vessel-photos', false),
    ('service-attachments', 'service-attachments', false),
    ('work-order-media', 'work-order-media', false),
    ('quotation-pdfs', 'quotation-pdfs', false),
    ('invoice-pdfs', 'invoice-pdfs', false),
    ('reports', 'reports', false)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

  EXECUTE 'DROP POLICY IF EXISTS avatars_public_read ON storage.objects';
  EXECUTE $p$CREATE POLICY avatars_public_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars')$p$;

  EXECUTE 'DROP POLICY IF EXISTS avatars_own_write ON storage.objects';
  EXECUTE $p$CREATE POLICY avatars_own_write ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)$p$;
  EXECUTE 'DROP POLICY IF EXISTS avatars_own_update ON storage.objects';
  EXECUTE $p$CREATE POLICY avatars_own_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)$p$;

  EXECUTE 'DROP POLICY IF EXISTS vessel_photos_rw ON storage.objects';
  EXECUTE $p$CREATE POLICY vessel_photos_rw ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'vessel-photos' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.customers WHERE profile_id = auth.uid())
        OR public.current_role() IN ('administrator','service_manager','technician','supervisor')
      )
    )
    WITH CHECK (
      bucket_id = 'vessel-photos' AND (
        (storage.foldername(name))[1] IN (SELECT id::text FROM public.customers WHERE profile_id = auth.uid())
        OR public.current_role() IN ('administrator','service_manager','technician','supervisor')
      )
    )$p$;

  EXECUTE 'DROP POLICY IF EXISTS service_attachments_rw ON storage.objects';
  EXECUTE $p$CREATE POLICY service_attachments_rw ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'service-attachments' AND (
        (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.service_requests WHERE customer_id IN (
            SELECT id FROM public.customers WHERE profile_id = auth.uid()
          )
        )
        OR public.current_role() IN ('administrator','service_manager','supervisor','technician','receptionist')
      )
    )
    WITH CHECK (
      bucket_id = 'service-attachments' AND (
        (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.service_requests WHERE customer_id IN (
            SELECT id FROM public.customers WHERE profile_id = auth.uid()
          )
        )
        OR public.current_role() IN ('administrator','service_manager','supervisor','technician','receptionist')
      )
    )$p$;

  EXECUTE 'DROP POLICY IF EXISTS work_order_media_rw ON storage.objects';
  EXECUTE $p$CREATE POLICY work_order_media_rw ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'work-order-media' AND (
        (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.work_orders WHERE assigned_to = auth.uid() OR supervisor_id = auth.uid()
        )
        OR public.current_role() IN ('administrator','service_manager','supervisor')
      )
    )
    WITH CHECK (
      bucket_id = 'work-order-media' AND (
        (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.work_orders WHERE assigned_to = auth.uid() OR supervisor_id = auth.uid()
        )
        OR public.current_role() IN ('administrator','service_manager','supervisor')
      )
    )$p$;

  EXECUTE 'DROP POLICY IF EXISTS pdf_buckets_staff ON storage.objects';
  EXECUTE $p$CREATE POLICY pdf_buckets_staff ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id IN ('quotation-pdfs','invoice-pdfs','reports')
      AND public.current_role() IN ('administrator','service_manager','finance_manager','store_manager')
    )
    WITH CHECK (
      bucket_id IN ('quotation-pdfs','invoice-pdfs','reports')
      AND public.current_role() IN ('administrator','service_manager','finance_manager','store_manager')
    )$p$;

  EXECUTE 'DROP POLICY IF EXISTS invoice_pdf_customer_read ON storage.objects';
  EXECUTE $p$CREATE POLICY invoice_pdf_customer_read ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'invoice-pdfs'
      AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.invoices WHERE customer_id IN (
          SELECT id FROM public.customers WHERE profile_id = auth.uid()
        )
      )
    )$p$;
END $$;
