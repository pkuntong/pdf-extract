import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { ExtractionResult, LineItem } from '@/types/extraction';

// Use PDF.js directly (avoids pdf-parse debug path ENOENT issues)
let pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null;

async function initPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (typeof window === 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
  }
  return pdfjsLib;
}

// Simple PDF text extraction using pdfjs-dist
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('PDF file is empty');
    }

    const pdfjs = await initPdfJs();
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await pdfjs.getDocument({
      data: uint8Array,
      verbosity: 0,
      disableAutoFetch: true,
      disableStream: true,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false
    }).promise;

    if (!pdf || pdf.numPages === 0) {
      throw new Error('PDF has no pages');
    }

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 50);
    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .filter((t: string) => t.trim().length > 0)
          .join(' ');
        if (pageText.trim()) fullText += pageText + '\n';
      } catch (pageError) {
        console.warn(`Failed to process page ${i}:`, pageError);
        continue;
      }
    }

    if (!fullText.trim()) {
      throw new Error('No readable text found in PDF');
    }

    return fullText.trim();
  } catch {
    // Fallback to pdf-parse (debugging disabled fork) for better compatibility
    try {
      const buffer = Buffer.from(arrayBuffer);
      const pdfParse = (await import('pdf-parse-debugging-disabled')).default;
      const result = await pdfParse(buffer, { max: 50 });
      if (!result.text || !result.text.trim()) {
        throw new Error('No readable text found in PDF');
      }
      return result.text.trim();
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
      if (message.includes('Object.defineProperty called on non-object')) {
        throw new Error('PDF file format not supported or file is corrupted');
      }
      throw new Error(`PDF parsing failed: ${message}`);
    }
  }
}

// Enhanced line item extraction function
function extractLineItems(text: string): LineItem[] {
  const lineItems: LineItem[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Look for table-like structures with products/services
  const tablePatterns = [
    // Pattern for: Description | Qty | Price | Amount
    /^(.{10,50})\s+(\d+(?:\.\d{1,2})?)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)$/,
    // Pattern for: Description | Amount
    /^(.{10,80})\s+\$?([\d,]+\.\d{2})$/,
    // Pattern with quantity: Qty Description Price Total
    /^(\d+(?:\.\d{1,2})?)\s+(.{10,50})\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)$/,
  ];
  
  // Common table headers to identify line item sections
  const tableHeaders = [
    /description|item|service|product/i,
    /qty|quantity|amount/i,
    /price|rate|cost/i,
    /total|subtotal/i
  ];
  
  let inLineItemSection = false;
  let lineCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if we're entering a line item section
    if (!inLineItemSection) {
      const hasTableHeaders = tableHeaders.some(header => header.test(line));
      if (hasTableHeaders) {
        inLineItemSection = true;
        continue;
      }
    }
    
    // Skip if we haven't found the line items section yet
    if (!inLineItemSection) continue;
    
    // Stop if we hit common invoice footer sections
    if (/^(subtotal|tax|total|notes?|payment|due|thank)/i.test(line)) {
      break;
    }
    
    // Try to parse line items using different patterns
    for (const pattern of tablePatterns) {
      const match = line.match(pattern);
      if (match) {
        let lineItem: LineItem;
        
        if (match.length === 5) {
          // Description | Qty | Price | Amount format
          lineItem = {
            description: match[1].trim(),
            quantity: parseFloat(match[2]),
            unitPrice: parseFloat(match[3].replace(/,/g, '')),
            amount: parseFloat(match[4].replace(/,/g, ''))
          };
        } else if (match.length === 4) {
          // Qty | Description | Price | Amount format
          lineItem = {
            description: match[2].trim(),
            quantity: parseFloat(match[1]),
            unitPrice: parseFloat(match[3].replace(/,/g, '')),
            amount: parseFloat(match[4].replace(/,/g, ''))
          };
        } else if (match.length === 3) {
          // Description | Amount format
          lineItem = {
            description: match[1].trim(),
            amount: parseFloat(match[2].replace(/,/g, ''))
          };
        } else {
          continue;
        }
        
        // Validate line item data
        if (lineItem.description && lineItem.description.length > 5 && 
            (lineItem.amount && lineItem.amount > 0)) {
          lineItems.push(lineItem);
          lineCount++;
          
          // Limit to prevent excessive parsing
          if (lineCount >= 20) break;
        }
        break;
      }
    }
  }
  
  return lineItems;
}

function extractInvoiceData(text: string, filename: string): ExtractionResult {
  const result: ExtractionResult = { filename };
  
  // Enhanced invoice number extraction
  const invoicePatterns = [
    /(?:invoice|inv|bill)\s*(?:number|#|no\.?)?[:\s#]+([A-Z0-9\-_]{3,})/i,
    /(?:^|\s)([A-Z]{2,}-?\d{4,})/m,
    /#\s*([A-Z0-9\-_]{3,})/i,
    /invoice[:\s]+([A-Z0-9\-_]{3,})/i,
  ];
  
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.invoiceNumber = match[1].trim();
      break;
    }
  }
  
  // Enhanced date extraction
  const datePatterns = [
    /(?:invoice\s*date|date|issued|bill\s*date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /(?:date)[:\s]+(\w{3,9}\s+\d{1,2},?\s+\d{4})/i, // Jan 15, 2024
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.date = match[1].trim();
      break;
    }
  }
  
  // Enhanced vendor extraction
  const vendorPatterns = [
    /(?:from|vendor|company|bill\s*to|sold\s*by)[:\s]+([A-Za-z\s&,.\-'()]{3,60})/i,
    /^([A-Z][A-Za-z\s&,.\-'()]{5,50})(?:\n|$)/m,
  ];
  
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim().replace(/[:\n\r]+$/, '');
      if (vendor.length > 2 && vendor.length < 60) {
        result.vendor = vendor;
        break;
      }
    }
  }
  
  // Enhanced amount extraction
  const subtotalPatterns = [
    /(?:subtotal|sub\s*total)[:\s]+\$?\s*([\d,]+\.?\d*)/i,
  ];
  
  const taxPatterns = [
    /(?:tax|vat)[:\s]+\$?\s*([\d,]+\.?\d*)/i,
    /(?:tax\s*rate)[:\s]+(\d+(?:\.\d{1,2})?%)/i,
  ];
  
  const totalPatterns = [
    /(?:total|grand\s*total|amount\s*due|final\s*amount)[:\s]+\$?\s*([\d,]+\.?\d*)/i,
    /(?:total)[:\s]+\$?\s*([\d,]+\.\d{2})/i,
    /\$\s*([\d,]+\.\d{2})(?:\s|$)/,
  ];
  
  // Extract subtotal
  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = match[1].replace(/,/g, '');
      if (parseFloat(amount) > 0) {
        result.subtotal = amount;
        break;
      }
    }
  }
  
  // Extract tax
  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      if (match[1].includes('%')) {
        result.taxRate = match[1];
      } else {
        const amount = match[1].replace(/,/g, '');
        if (parseFloat(amount) > 0) {
          result.tax = amount;
        }
      }
      break;
    }
  }
  
  // Extract total
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = match[1].replace(/,/g, '');
      if (parseFloat(amount) > 0) {
        result.total = amount;
        break;
      }
    }
  }
  
  // Extract line items
  const lineItems = extractLineItems(text);
  if (lineItems.length > 0) {
    result.lineItems = lineItems;
  }
  
  return result;
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Simple PDF extraction API endpoint. Use POST to extract data from PDFs.',
    note: 'This version uses pdfjs-dist directly for robust server-side parsing'
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 files allowed' }, { status: 400 });
    }
    
    const extractions: ExtractionResult[] = [];
    
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `File is not a PDF`
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `File too large (max 10MB)`
        });
        continue;
      }
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractTextFromPDF(arrayBuffer);
        const extractedData = extractInvoiceData(text, file.name || 'Unknown file');
        extractions.push(extractedData);
        
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        extractions.push({
          filename: file.name || 'Unknown file',
          error: error instanceof Error ? error.message : 'Processing failed'
        });
      }
    }
    
    return NextResponse.json({
      extractions,
      metadata: {
        totalFiles: files.length,
        successfulExtractions: extractions.filter(e => !e.error).length,
        timestamp: new Date().toISOString(),
      }
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}