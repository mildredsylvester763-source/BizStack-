export type InvoiceSettings = {
  show_logo: boolean; show_customer_address: boolean; show_tax: boolean; show_discount: boolean;
  show_shipping: boolean; show_reference: boolean; show_purchase_order: boolean; show_notes: boolean;
  show_terms: boolean; show_product_image: boolean; show_sku: boolean; show_payment_details: boolean;
  show_signature: boolean; show_qr_payment: boolean;
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  show_logo:true, show_customer_address:true, show_tax:true, show_discount:true, show_shipping:false,
  show_reference:true, show_purchase_order:true, show_notes:true, show_terms:true, show_product_image:false,
  show_sku:true, show_payment_details:true, show_signature:false, show_qr_payment:false
};

export const CORE_INVOICE_FIELDS = [
  "invoice_number","business_identity","customer_identity","issue_date","currency","line_items","total","status"
] as const;

export type BusinessSettings = {
  tax_mode: "auto"|"manual"|"disabled";
  default_tax_rate: number;
  default_tax_name: string|null;
  tax_registration_number: string|null;
  tax_jurisdiction: string|null;
  tax_inclusive: boolean;
  invoice_settings: InvoiceSettings;
  module_settings: Record<string, boolean>;
  sync_settings: Record<string, boolean|string>;
};

export function mergeInvoiceSettings(value?: Partial<InvoiceSettings>|null): InvoiceSettings {
  return {...DEFAULT_INVOICE_SETTINGS, ...(value ?? {})};
}