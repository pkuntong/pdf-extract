declare module 'pdf-parse-debugging-disabled' {
  import type { Buffer } from 'node:buffer';

  export interface PDFParseResult {
    text: string;
    // Additional fields vary by PDF and library internals; keep loose for compatibility
    [key: string]: unknown;
  }

  export type PDFParse = (
    data: Buffer | Uint8Array,
    // Options are not strictly typed by the package; keep as unknown/any-safe
    options?: Record<string, unknown>
  ) => Promise<PDFParseResult>;

  const pdfParse: PDFParse;
  export default pdfParse;
}


