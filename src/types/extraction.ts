export interface LineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  notes?: string;
}

export interface ExtractionResult {
  invoiceNumber?: string;
  date?: string;
  vendor?: string;
  total?: string;
  subtotal?: string;
  tax?: string;
  taxRate?: string;
  filename?: string;
  error?: string;
  lineItems?: LineItem[];
}

export interface UploadResponse {
  extractions: ExtractionResult[];
  error?: string;
}

export interface FileProcessingError {
  filename: string;
  error: string;
}