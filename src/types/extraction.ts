export interface ExtractionResult {
  invoiceNumber?: string;
  date?: string;
  vendor?: string;
  total?: string;
  filename?: string;
  error?: string;
}

export interface UploadResponse {
  extractions: ExtractionResult[];
  error?: string;
}

export interface FileProcessingError {
  filename: string;
  error: string;
}