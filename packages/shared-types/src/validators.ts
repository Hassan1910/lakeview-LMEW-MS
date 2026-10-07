import { z } from 'zod';

// Kenya phone: +2547XXXXXXXX or 07XXXXXXXX
export const kenyanPhoneRegex = /^(?:\+254|0)[17]\d{8}$/;

// ---------------------------------------------------------------------------
// Service Request
// ---------------------------------------------------------------------------
export const ServiceRequestCreateSchema = z.object({
  vessel_id: z.string().uuid().optional().nullable(),
  category: z.enum([
    'boat_repair',
    'ship_repair',
    'engine_maintenance',
    'fabrication',
    'electrical',
    'welding',
    'equipment_supply',
    'consultation',
    'other',
  ]),
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(10, 'Please provide a detailed description (min 10 characters)'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  preferred_date: z.string().optional().nullable(),
  location_text: z.string().min(3, 'Location is required (e.g. Kisumu Dunga Pier, Slipway 2)'),
  location_lat: z.number().optional().nullable(),
  location_lng: z.number().optional().nullable(),
});

export type ServiceRequestCreateInput = z.infer<typeof ServiceRequestCreateSchema>;

// ---------------------------------------------------------------------------
// Quotation
// ---------------------------------------------------------------------------
export const QuotationItemSchema = z.object({
  inventory_item_id: z.string().uuid().optional().nullable(),
  description: z.string().min(2, 'Description is required'),
  quantity: z.number().positive('Quantity must be > 0'),
  unit_price: z.number().nonnegative('Unit price must be >= 0'),
});

export const QuotationCreateSchema = z.object({
  service_request_id: z.string().uuid(),
  valid_until: z.string().min(10, 'Valid until date is required'),
  notes: z.string().optional().nullable(),
  items: z.array(QuotationItemSchema).min(1, 'At least one line item is required'),
});

export type QuotationCreateInput = z.infer<typeof QuotationCreateSchema>;

// ---------------------------------------------------------------------------
// Vessel
// ---------------------------------------------------------------------------
export const VesselCreateSchema = z.object({
  name: z.string().min(2, 'Vessel name is required'),
  registration_no: z.string().min(2, 'Registration or licence number is required'),
  type: z.enum([
    'fishing_boat',
    'passenger_boat',
    'cargo_boat',
    'tugboat',
    'speedboat',
    'ferry',
    'other',
  ]).optional().nullable(),
  engine_details: z.string().optional().nullable(),
  length_m: z.number().positive().optional().nullable(),
  year_built: z.number().int().min(1900).max(2100).optional().nullable(),
});

export type VesselCreateInput = z.infer<typeof VesselCreateSchema>;

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
export const FeedbackCreateSchema = z.object({
  service_request_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  category: z.enum([
    'service_quality',
    'timeliness',
    'communication',
    'pricing',
    'technician',
    'other',
  ]).optional().nullable(),
  comment: z.string().max(1000).optional().nullable(),
});

export type FeedbackCreateInput = z.infer<typeof FeedbackCreateSchema>;

// ---------------------------------------------------------------------------
// Inventory Item
// ---------------------------------------------------------------------------
export const InventoryItemCreateSchema = z.object({
  sku: z.string().min(2, 'SKU is required'),
  name: z.string().min(3, 'Item name is required'),
  category_id: z.string().uuid().optional().nullable(),
  unit: z.string().default('pcs'),
  unit_cost: z.number().nonnegative(),
  unit_price: z.number().nonnegative(),
  quantity_on_hand: z.number().int().min(0).default(0),
  reorder_level: z.number().int().min(0).default(0),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export type InventoryItemCreateInput = z.infer<typeof InventoryItemCreateSchema>;

// ---------------------------------------------------------------------------
// Paystack Payment Initiation
// ---------------------------------------------------------------------------
export const PaystackInitSchema = z.object({
  invoice_id: z.string().uuid(),
  email: z.string().email('Valid email required for Paystack'),
  callback_url: z.string().min(1).optional(),
});

export type PaystackInitInput = z.infer<typeof PaystackInitSchema>;

export const PaystackVerifySchema = z.object({
  reference: z.string().trim().min(1).max(200),
  observe: z.boolean().optional(),
});

export type PaystackVerifyInput = z.infer<typeof PaystackVerifySchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const RegisterSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z
    .string()
    .regex(kenyanPhoneRegex, 'Enter a valid Kenyan phone number (+254 or 07/01...)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*\d)/, 'Password must include letters and at least one number'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
