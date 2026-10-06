export interface PaystackInitializeRequest {
  email: string;
  amount: number; // in lowest currency unit: Kenyan Shillings KES * 100 (cents)
  reference?: string;
  currency?: string; // 'KES'
  callback_url?: string;
  channels?: Array<'card' | 'bank' | 'mobile_money' | 'qr' | 'ussd' | 'bank_transfer'>;
  metadata?: {
    invoice_id: string;
    customer_id: string;
    service_request_id?: string;
    custom_fields?: Array<{
      display_name: string;
      variable_name: string;
      value: string;
    }>;
  };
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    message?: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string; // 'card', 'mobile_money', 'bank', etc.
    currency: string;
    ip_address: string;
    metadata?: Record<string, any>;
    customer: {
      id: number;
      first_name?: string | null;
      last_name?: string | null;
      email: string;
      customer_code: string;
      phone?: string | null;
    };
  };
}

export interface PaystackWebhookPayload {
  event: 'charge.success' | 'transfer.success' | 'transfer.failed';
  data: PaystackVerifyResponse['data'];
}
