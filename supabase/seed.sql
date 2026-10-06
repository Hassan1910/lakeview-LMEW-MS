-- LMEW local seed. Demo password for every auth user: LmewDemo123
-- Profiles are created by handle_new_user (role customer) and then promoted.

INSERT INTO company_info (id, name, about, mission, vision, phone, email, address, latitude, longitude)
VALUES (
  1,
  'Lakeview Marine Engineering Works',
  'Lakeview Marine Engineering Works services fishing boats, ferries, and cargo vessels operating on Lake Victoria from Kisumu.',
  'Keep Lake Victoria vessels safe, seaworthy, and earning.',
  'The most trusted marine workshop on the lake.',
  '+254712345678',
  'service@lakeviewmarine.co.ke',
  'Marine Drive, Kisumu Pier Yards, Lake Victoria, Kenya',
  -0.091700,
  34.768000
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  about = EXCLUDED.about,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  address = EXCLUDED.address;

INSERT INTO inventory_categories (id, name, description) VALUES
('d0000000-0000-0000-0000-000000000001', 'Marine Engines & Mechanical', 'Outboard and inboard spare components'),
('d0000000-0000-0000-0000-000000000002', 'Electrical & Navigation', 'Batteries, pumps, and navigation gear'),
('d0000000-0000-0000-0000-000000000003', 'Hull, Rigging & Hardware', 'Fasteners, resin, propellers, anodes'),
('d0000000-0000-0000-0000-000000000004', 'Lubricants & Marine Fluids', 'Outboard oils and hydraulic fluid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_items (id, sku, name, category_id, unit, unit_cost, unit_price, quantity_on_hand, reorder_level, location, is_active) VALUES
('e0000000-0000-0000-0000-000000000001', 'YAM-IMP-040', 'Yamaha 40HP Water Pump Impeller', 'd0000000-0000-0000-0000-000000000001', 'pcs', 2200.00, 3500.00, 18, 5, 'BIN-M12', true),
('e0000000-0000-0000-0000-000000000002', 'SPK-NGK-B7HS', 'NGK B7HS Marine Spark Plug', 'd0000000-0000-0000-0000-000000000001', 'pcs', 450.00, 750.00, 42, 12, 'BIN-M03', true),
('e0000000-0000-0000-0000-000000000003', 'RUL-BLG-1100', 'Rule 1100 GPH 12V Bilge Pump', 'd0000000-0000-0000-0000-000000000002', 'pcs', 6800.00, 9500.00, 7, 3, 'BIN-E04', true),
('e0000000-0000-0000-0000-000000000004', 'YAM-LUB-TCW3', 'Yamalube TC-W3 2-Stroke Oil 4L', 'd0000000-0000-0000-0000-000000000004', 'pcs', 3100.00, 4200.00, 25, 8, 'SHELF-OIL-2', true),
('e0000000-0000-0000-0000-000000000005', 'PROP-ALU-13X19', 'Solas 13 x 19 Aluminum Propeller', 'd0000000-0000-0000-0000-000000000003', 'pcs', 14500.00, 21000.00, 2, 4, 'BIN-H01', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO suppliers (id, name, contact_person, email, phone, address, category, is_active) VALUES
('f0000000-0000-0000-0000-000000000001', 'Kenya Marine Supplies Ltd', 'David Omwega', 'sales@kenyamarine.co.ke', '+254722883311', 'Industrial Area, Nairobi', 'Hardware', true),
('f0000000-0000-0000-0000-000000000002', 'Yamaha Motors East Africa', 'Grace Muthoni', 'parts@yamaha-ea.com', '+254733990022', 'Commercial Street, Kisumu', 'Engines', true)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  pwd text := crypt('LmewDemo123', gen_salt('bf'));
  rec record;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users missing; skipping demo logins';
    RETURN;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      ('b0000000-0000-0000-0000-000000000001'::uuid, 'kevin@lakeviewmarine.co.ke', 'Kevin Kiprotich Langat', '+254711000001', 'administrator'),
      ('b0000000-0000-0000-0000-000000000002'::uuid, 'david@lakeviewmarine.co.ke', 'David Muriithi', '+254711000002', 'service_manager'),
      ('b0000000-0000-0000-0000-000000000003'::uuid, 'otieno@lakeviewmarine.co.ke', 'Otieno James', '+254711000003', 'supervisor'),
      ('b0000000-0000-0000-0000-000000000004'::uuid, 'brian@lakeviewmarine.co.ke', 'Brian Omondi', '+254711000004', 'technician'),
      ('b0000000-0000-0000-0000-000000000005'::uuid, 'samuel@lakeviewmarine.co.ke', 'Samuel Kipkorir', '+254711000005', 'technician'),
      ('b0000000-0000-0000-0000-000000000006'::uuid, 'mercy@lakeviewmarine.co.ke', 'Mercy Chebet', '+254711000006', 'finance_manager'),
      ('b0000000-0000-0000-0000-000000000007'::uuid, 'george@lakeviewmarine.co.ke', 'George Onyango', '+254711000007', 'store_manager'),
      ('b0000000-0000-0000-0000-000000000008'::uuid, 'grace@lakeviewmarine.co.ke', 'Achieng Grace', '+254711000008', 'receptionist'),
      ('b0000000-0000-0000-0000-000000000009'::uuid, 'peter.wanyama@victoriaferries.co.ke', 'Captain Peter Wanyama', '+254722112233', 'customer'),
      ('b0000000-0000-0000-0000-000000000010'::uuid, 'hassan.ali@lakefishers.com', 'Hassan Ali Mohamed', '+254733445566', 'customer'),
      ('b0000000-0000-0000-0000-000000000011'::uuid, 'procurement@lakeviewmarine.co.ke', 'Nelly Akinyi', '+254711000011', 'procurement_officer'),
      ('b0000000-0000-0000-0000-000000000012'::uuid, 'supplier@kenyamarine.co.ke', 'David Omwega', '+254711000012', 'supplier')
    ) AS u(id, email, full_name, phone, role)
  LOOP
    BEGIN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        rec.id,
        'authenticated',
        'authenticated',
        rec.email,
        pwd,
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', rec.full_name, 'phone', rec.phone),
        NOW(), NOW(), '', '', '', ''
      );
    EXCEPTION WHEN unique_violation THEN
      NULL;
    WHEN undefined_column OR not_null_violation THEN
      -- Older or stub auth.users: insert the columns the trigger needs.
      INSERT INTO auth.users (id, email, phone, raw_user_meta_data)
      VALUES (rec.id, rec.email, rec.phone, jsonb_build_object('full_name', rec.full_name, 'phone', rec.phone))
      ON CONFLICT (id) DO NOTHING;
    END;

    UPDATE public.profiles
    SET role_id = (SELECT id FROM public.roles WHERE key = rec.role),
        full_name = rec.full_name,
        phone = rec.phone,
        email = rec.email,
        address = 'Kisumu',
        county = 'Kisumu'
    WHERE id = rec.id;
  END LOOP;

  IF to_regclass('auth.identities') IS NOT NULL THEN
    BEGIN
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      SELECT gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', email), 'email', id::text, NOW(), NOW(), NOW()
      FROM auth.users
      WHERE email LIKE '%lakeviewmarine.co.ke' OR email LIKE '%victoriaferries.co.ke' OR email LIKE '%lakefishers.com' OR email LIKE '%kenyamarine.co.ke'
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN undefined_column OR unique_violation THEN
      NULL;
    END;
  END IF;

  INSERT INTO customers (id, profile_id, company_name, kra_pin, notes, created_by) VALUES
  ('c1000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009', 'Victoria Ferries Ltd', 'P051029384A', 'Ferry operator at Kisumu Pier', 'b0000000-0000-0000-0000-000000000008'),
  ('c1000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010', 'Nyanza Fisheries Cooperative', 'P052847192B', 'Fishing fleet at Dunga', 'b0000000-0000-0000-0000-000000000008')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO vessels (id, customer_id, name, registration_no, type, engine_details, length_m, year_built) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000009', 'MV Victoria Star', 'KMA/REG/2021/048', 'ferry', 'Twin Yamaha F250 Outboards', 15.20, 2021),
  ('c0000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000010', 'Simba wa Ziwa II', 'KMA/FSH/2023/112', 'fishing_boat', 'Yamaha Enduro 40HP', 9.50, 2023)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO service_requests (
    id, customer_id, vessel_id, category, title, description, priority, status, location_text, created_by
  ) VALUES (
    '80000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000009',
    'c0000000-0000-0000-0000-000000000001',
    'engine_maintenance',
    'Port engine overheating',
    'Port-side Yamaha 250HP outboard overheats under load above 3500 RPM. Telltale stream is weak.',
    'high',
    'request_received',
    'Kisumu Main Pier, Slipway 2',
    'b0000000-0000-0000-0000-000000000009'
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE service_requests
  SET status = 'inspection_in_progress', assigned_service_manager = 'b0000000-0000-0000-0000-000000000002'
  WHERE id = '80000000-0000-0000-0000-000000000001';

  INSERT INTO work_orders (id, service_request_id, assigned_to, supervisor_id, status, notes, created_by)
  VALUES (
    '90000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000003',
    'assigned',
    'Inspect cooling telltale and impeller.',
    'b0000000-0000-0000-0000-000000000002'
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE suppliers SET profile_id = 'b0000000-0000-0000-0000-000000000012'
  WHERE id = 'f0000000-0000-0000-0000-000000000001';
END $$;
