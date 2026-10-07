// =============================================================================
// LMEW-MS — Database Types
// Hand-maintained until `pnpm db:types` can run against a local Supabase database.
// Includes payments.proof_path from 20250101000005_security_and_flows.sql.
// DO NOT edit enum values — they mirror the Postgres ENUMs exactly.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Enums — must exactly match CREATE TYPE ... AS ENUM in the SQL migration
// ---------------------------------------------------------------------------

/** Keys of the built-in rows in public.roles. */
export type SystemRoleKey =
  | 'customer'
  | 'administrator'
  | 'service_manager'
  | 'supervisor'
  | 'technician'
  | 'finance_manager'
  | 'store_manager'
  | 'procurement_officer'
  | 'receptionist'
  | 'supplier';

/** profiles.role mirrors roles.key; administrators can add custom keys. */
export type UserRole = SystemRoleKey | (string & {});

/** Actions in the permission catalog; a permission key is `${module}.${action}`. */
export type PermissionAction =
  | 'access'
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'export'
  | 'print'
  | 'submit'
  | 'assign'
  | 'execute'
  | 'manage'
  | 'view_reports'
  | 'view_own'
  | 'edit_own';

/** 10-step service lifecycle — matches service_status enum */
export type ServiceStatus =
  | 'request_received'
  | 'inspection_in_progress'
  | 'quotation_pending'
  | 'quotation_sent'
  | 'awaiting_approval'
  | 'awaiting_spare_parts'
  | 'under_repair'
  | 'testing'
  | 'completed'
  | 'cancelled';

export type WorkOrderStatus =
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired';

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled' | 'refunded';

/**
 * payment_method enum — includes 'paystack' (project decision to keep Paystack gateway).
 * The DB enum currently only has mpesa,bank_transfer,cash,card,cheque.
 * A future migration should ADD 'paystack' to the enum if/when payments go live.
 */
export type PaymentMethod =
  | 'mpesa'
  | 'paystack'
  | 'bank_transfer'
  | 'cash'
  | 'card'
  | 'cheque';

export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'shipped'
  | 'received'
  | 'cancelled';

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'return';

export type VesselType =
  | 'fishing_boat'
  | 'passenger_boat'
  | 'cargo_boat'
  | 'tugboat'
  | 'speedboat'
  | 'ferry'
  | 'other';

export type ServiceCategory =
  | 'boat_repair'
  | 'ship_repair'
  | 'engine_maintenance'
  | 'fabrication'
  | 'electrical'
  | 'welding'
  | 'equipment_supply'
  | 'consultation'
  | 'other';

export type NotificationType =
  | 'service_status'
  | 'quotation'
  | 'invoice'
  | 'payment'
  | 'assignment'
  | 'low_stock'
  | 'feedback'
  | 'system';

export type FeedbackCategory =
  | 'service_quality'
  | 'timeliness'
  | 'communication'
  | 'pricing'
  | 'technician'
  | 'other';

// ---------------------------------------------------------------------------
// Interfaces — field names match SQL column names exactly
// ---------------------------------------------------------------------------

/** profiles table — extends auth.users */
export interface Profile {
  id: string;           // uuid, FK -> auth.users.id
  role: UserRole;       // kept in sync with role_id by trigger
  role_id: string;      // FK -> roles.id
  full_name: string;
  email: string | null;
  phone: string | null; // was: phone_number (WRONG)
  avatar_url: string | null;
  is_active: boolean;
  address: string | null;
  county: string | null;
  expo_push_token: string | null;
  created_at: string;
  updated_at: string;
}

/** customers table */
export interface Customer {
  id: string;           // uuid PK
  profile_id: string | null;  // FK -> profiles.id (null for walk-ins)
  company_name: string | null;
  kra_pin: string | null;
  notes: string | null;
  created_by: string | null;  // FK -> profiles.id
  created_at: string;
}

/** vessels table */
export interface Vessel {
  id: string;
  customer_id: string;
  name: string;
  registration_no: string | null;  // was: registration_number (WRONG)
  type: VesselType | null;          // was: vessel_type (WRONG)
  length_m: number | null;          // was: length_metres (WRONG)
  engine_details: string | null;
  year_built: number | null;
  photo_url: string | null;
  created_at: string;
}

/** service_requests table */
export interface ServiceRequest {
  id: string;
  code: string | null;            // was: request_number (WRONG), e.g. LMEW-SR-2025-0001
  customer_id: string;
  vessel_id: string | null;
  category: ServiceCategory;      // was: service_category (WRONG)
  title: string;
  description: string;
  priority: Priority;
  status: ServiceStatus;
  preferred_date: string | null;
  location_text: string | null;   // was: location (WRONG)
  location_lat: number | null;
  location_lng: number | null;
  assigned_service_manager: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** service_request_status_history table */
export interface ServiceRequestStatusHistory {
  id: string;
  service_request_id: string;
  status: ServiceStatus;
  note: string | null;            // was: notes (WRONG)
  changed_by: string | null;
  created_at: string;
}

/** service_request_attachments table */
export interface ServiceRequestAttachment {
  id: string;
  service_request_id: string;
  storage_path: string;           // Supabase Storage path
  file_name: string | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** work_orders table */
export interface WorkOrder {
  id: string;
  code: string | null;            // was: work_order_number (WRONG)
  service_request_id: string;
  assigned_to: string;            // was: lead_technician_id (WRONG)
  supervisor_id: string | null;
  status: WorkOrderStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;    // was: started_at (WRONG)
  actual_end: string | null;      // was: completed_at (WRONG)
  notes: string | null;           // was: instructions / findings (WRONG)
  created_by: string | null;
  created_at: string;
}

/** work_order_media table */
export interface WorkOrderMedia {
  id: string;
  work_order_id: string;
  storage_path: string | null;    // was: media_url (WRONG)
  kind: 'before' | 'after' | 'progress' | 'document' | null; // was: phase (WRONG)
  uploaded_by: string | null;
  created_at: string;
}

/** quotations table */
export interface Quotation {
  id: string;
  code: string | null;            // was: quotation_number (WRONG)
  service_request_id: string;
  status: QuotationStatus;
  currency: string;               // default 'KES'
  subtotal: number;
  tax_rate: number;               // default 16 (%)
  tax_amount: number;
  discount: number;               // was: discount_amount (WRONG)
  total: number;                  // was: total_amount (WRONG)
  valid_until: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** quotation_items table */
export interface QuotationItem {
  id: string;
  quotation_id: string;
  inventory_item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;             // was: total_price (WRONG), generated: quantity * unit_price
}

/** invoices table */
export interface Invoice {
  id: string;
  code: string | null;            // was: invoice_number (WRONG)
  quotation_id: string | null;
  service_request_id: string | null;
  customer_id: string;
  status: InvoiceStatus;
  currency: string;               // default 'KES'
  subtotal: number | null;
  tax_amount: number | null;
  discount: number;               // copied from the quotation at issue time
  total: number | null;           // was: total_amount (WRONG)
  amount_paid: number;            // default 0
  balance: number | null;        // was: balance_due (WRONG), generated: total - amount_paid
  issued_at: string | null;      // was: created_at only
  due_at: string | null;         // was: due_date (WRONG)
  created_by: string | null;
  created_at: string;
}

/** payments table */
export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;          // was: payment_method (WRONG)
  status: PaymentStatus;          // was: payment_status (WRONG)
  reference: string | null;       // was: transaction_reference (WRONG)
  mpesa_receipt: string | null;
  paid_at: string | null;
  recorded_by: string | null;
  raw_payload: Json | null;       // was: metadata (WRONG)
  proof_path: string | null;
  allow_overpayment: boolean;
  created_at: string;
}

/** invoice_items table — frozen copy of quotation lines at issue time */
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  inventory_item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

/** suppliers table */
export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;           // was: phone_number (WRONG)
  email: string | null;
  address: string | null;
  category: string | null;
  payment_terms: string | null;
  rating: number | null;
  is_active: boolean;
  profile_id: string | null;     // FK -> profiles.id (for supplier login)
  created_at: string;
}

/** inventory_categories table */
export interface InventoryCategory {
  id: string;
  name: string;
  description: string | null;
}

/** inventory_items table */
export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  description: string | null;
  unit: string;                   // default 'pcs'
  unit_cost: number | null;
  unit_price: number | null;      // was: selling_price (WRONG)
  quantity_on_hand: number;       // was: current_stock (WRONG)
  reorder_level: number;
  location: string | null;        // was: location_bin (WRONG)
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** stock_movements table */
export interface StockMovement {
  id: string;
  inventory_item_id: string;
  type: StockMovementType;        // was: movement_type (WRONG)
  quantity: number;
  reference: string | null;
  reason: string | null;          // was: notes (WRONG)
  related_work_order_id: string | null;
  related_po_id: string | null;
  created_by: string | null;      // was: performed_by (WRONG)
  created_at: string;
}

/** purchase_orders table */
export interface PurchaseOrder {
  id: string;
  code: string | null;            // was: po_number (WRONG)
  supplier_id: string;
  status: PurchaseOrderStatus;
  currency: string;               // default 'KES'
  total: number;                  // was: total_amount (WRONG)
  expected_date: string | null;   // was: expected_delivery (WRONG)
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
}

/** purchase_order_items table */
export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string | null;
  description: string | null;
  quantity: number | null;
  unit_cost: number | null;
  line_total: number | null;      // was: total_cost (WRONG), generated
}

/** feedback table */
export interface Feedback {
  id: string;
  service_request_id: string | null;
  customer_id: string;
  rating: number;                 // 1-5
  category: FeedbackCategory | null;
  comment: string | null;
  response: string | null;        // staff response text
  responded_by: string | null;
  created_at: string;
}

/** notifications table */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;            // was: message (WRONG)
  data: Json | null;              // was: link_url (WRONG)
  read_at: string | null;         // was: is_read:boolean (WRONG). null = unread
  created_at: string;
}

/** messages table — threaded chat on a service request */
export interface Message {
  id: string;
  service_request_id: string;
  sender_id: string;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
}

/** audit_logs table */
export interface AuditLog {
  id: number;                     // bigserial
  actor_id: string | null;
  actor_email: string | null;     // captured at write time so removed accounts stay identifiable
  action: string;
  entity: string;                 // table name, or 'accounts' for manage-users actions
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  changed_fields: string[] | null;
  created_at: string;
}

/** roles table */
export interface Role {
  id: string;
  key: UserRole;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** permissions table — the catalog the Roles page renders */
export interface Permission {
  key: string;
  module: string;
  action: PermissionAction;
  description: string | null;
}

/** role_permissions table */
export interface RolePermission {
  role_id: string;
  permission_key: string;
  granted_by: string | null;
  created_at: string;
}

/** company_info table — single row */
export interface CompanyInfo {
  id: number;                     // default 1
  name: string;
  about: string | null;
  mission: string | null;
  vision: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Convenience join types used in UI queries
// ---------------------------------------------------------------------------

export interface ServiceRequestWithRelations extends ServiceRequest {
  customer?: Customer | null;
  vessel?: Vessel | null;
  service_manager?: Profile | null;
}

export interface WorkOrderWithRelations extends WorkOrder {
  service_request?: ServiceRequest | null;
  technician?: Profile | null;
  supervisor?: Profile | null;
}

export interface QuotationWithItems extends Quotation {
  items?: QuotationItem[];
}

export interface InvoiceWithPayments extends Invoice {
  payments?: Payment[];
}

export interface WorkOrderPart {
  id: string;
  work_order_id: string;
  inventory_item_id: string;
  quantity: number;
  requested_by: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  customer_id: string;
  vessel_id: string | null;
  scheduled_at: string;
  purpose: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
