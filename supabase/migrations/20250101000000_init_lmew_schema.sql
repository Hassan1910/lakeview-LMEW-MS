-- Lakeview Marine Engineering Works (LMEW-MS)
-- Initial Schema Migration: Enums and Relational Tables

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ENUMS
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('customer', 'administrator', 'service_manager', 'supervisor', 'technician', 'finance_manager', 'store_manager', 'procurement_officer', 'receptionist', 'supplier'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE service_status AS ENUM ('request_received', 'inspection_in_progress', 'quotation_pending', 'quotation_sent', 'awaiting_approval', 'awaiting_spare_parts', 'under_repair', 'testing', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE work_order_status AS ENUM ('assigned', 'in_progress', 'blocked', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('mpesa', 'bank_transfer', 'cash', 'card', 'cheque'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE purchase_order_status AS ENUM ('draft', 'sent', 'acknowledged', 'shipped', 'received', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'adjustment', 'return'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE vessel_type AS ENUM ('fishing_boat', 'passenger_boat', 'cargo_boat', 'tugboat', 'speedboat', 'ferry', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE service_category AS ENUM ('boat_repair', 'ship_repair', 'engine_maintenance', 'fabrication', 'electrical', 'welding', 'equipment_supply', 'consultation', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('service_status', 'quotation', 'invoice', 'payment', 'assignment', 'low_stock', 'feedback', 'system'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE feedback_category AS ENUM ('service_quality', 'timeliness', 'communication', 'pricing', 'technician', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'customer' NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    address TEXT,
    county TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    company_name TEXT,
    kra_pin TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    registration_no TEXT UNIQUE,
    type vessel_type,
    length_m NUMERIC(6,2),
    engine_details TEXT,
    year_built INT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vessels_customer_id ON vessels(customer_id);
CREATE INDEX IF NOT EXISTS idx_vessels_registration_no ON vessels(registration_no);

CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vessel_id UUID REFERENCES vessels(id) ON DELETE CASCADE,
    category service_category NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority priority DEFAULT 'medium',
    status service_status DEFAULT 'request_received',
    preferred_date DATE,
    location_text TEXT,
    location_lat NUMERIC(9,6),
    location_lng NUMERIC(9,6),
    assigned_service_manager UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_requests_customer_id ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_service_requests_category ON service_requests(category);

CREATE TABLE IF NOT EXISTS service_request_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
    status service_status NOT NULL,
    note TEXT,
    changed_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_request_status_history_service_request_id ON service_request_status_history(service_request_id);

CREATE TABLE IF NOT EXISTS service_request_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status work_order_status DEFAULT 'assigned',
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_orders_service_request_id ON work_orders(service_request_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

CREATE TABLE IF NOT EXISTS work_order_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    storage_path TEXT,
    kind TEXT CHECK (kind IS NULL OR kind IN ('before','after','progress','document')),
    uploaded_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    status quotation_status DEFAULT 'draft',
    currency TEXT DEFAULT 'KES',
    subtotal NUMERIC(12,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 16,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    valid_until DATE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotations_service_request_id ON quotations(service_request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status invoice_status DEFAULT 'draft',
    currency TEXT DEFAULT 'KES',
    subtotal NUMERIC(12,2),
    tax_amount NUMERIC(12,2),
    total NUMERIC(12,2),
    amount_paid NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2) GENERATED ALWAYS AS ((COALESCE(total, 0) - COALESCE(amount_paid, 0))::numeric(12,2)) STORED,
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_at ON invoices(due_at);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'KES',
    method payment_method NOT NULL,
    status payment_status DEFAULT 'pending',
    reference TEXT,
    mpesa_receipt TEXT,
    paid_at TIMESTAMPTZ,
    recorded_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_mpesa_receipt ON payments(mpesa_receipt);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    category TEXT,
    payment_terms TEXT,
    rating NUMERIC(3,2),
    is_active BOOLEAN DEFAULT TRUE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT
);


CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES inventory_categories(id) ON DELETE CASCADE,
    description TEXT,
    unit TEXT DEFAULT 'pcs',
    unit_cost NUMERIC(12,2),
    unit_price NUMERIC(12,2),
    quantity_on_hand NUMERIC(12,2) DEFAULT 0,
    reorder_level NUMERIC(12,2) DEFAULT 0,
    location TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_quantity_on_hand ON inventory_items(quantity_on_hand);


CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    line_total NUMERIC(12,2) GENERATED ALWAYS AS ((quantity * unit_price)::numeric(12,2)) STORED
);

CREATE TABLE IF NOT EXISTS work_order_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_order_parts_work_order_id ON work_order_parts(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_parts_inventory_item_id ON work_order_parts(inventory_item_id);


CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    type stock_movement_type NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    reference TEXT,
    reason TEXT,
    related_work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    related_po_id UUID,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_item_id ON stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    status purchase_order_status DEFAULT 'draft',
    currency TEXT DEFAULT 'KES',
    total NUMERIC(12,2) DEFAULT 0,
    expected_date DATE,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);



ALTER TABLE stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_related_po_id_fkey;
ALTER TABLE stock_movements
    ADD CONSTRAINT stock_movements_related_po_id_fkey
    FOREIGN KEY (related_po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    description TEXT,
    quantity NUMERIC(12,2),
    unit_cost NUMERIC(12,2),
    line_total NUMERIC(12,2) GENERATED ALWAYS AS ((COALESCE(quantity, 0) * COALESCE(unit_cost, 0))::numeric(12,2)) STORED
);


CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rating INT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    category feedback_category,
    comment TEXT,
    response TEXT,
    responded_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_service_request_id ON feedback(service_request_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_service_request_id ON messages(service_request_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT,
    entity TEXT,
    entity_id UUID,
    before JSONB,
    after JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS company_info (
    id INT PRIMARY KEY DEFAULT 1,
    name TEXT DEFAULT 'Lakeview Marine Engineering Works',
    about TEXT,
    mission TEXT,
    vision TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference_unique
    ON payments(reference) WHERE reference IS NOT NULL;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.company_info TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
