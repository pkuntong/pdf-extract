import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { ExtractionResult } from '@/types/extraction';

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
    const pdf = await pdfjs.getDocument({ data: uint8Array, verbosity: 0 }).promise;

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
      } catch {
        continue;
      }
    }

    if (!fullText.trim()) {
      throw new Error('No readable text found in PDF');
    }

    return fullText.trim();
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractInvoiceData(text: string, filename: string): ExtractionResult {
  const result: ExtractionResult = { filename };
  
  // Simple invoice number extraction
  const invoicePatterns = [
    /(?:invoice|inv|bill)\s*(?:number|#|no\.?)?[:\s]+([A-Z0-9\-_]{3,})/i,
    /(?:^|\s)([A-Z]{2,}-?\d{4,})/m,
    /#\s*([A-Z0-9\-_]{3,})/i,
  ];
  
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.invoiceNumber = match[1].trim();
      break;
    }
  }
  
  // Simple date extraction
  const datePatterns = [
    /(?:date|issued)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.date = match[1].trim();
      break;
    }
  }
  
  // Simple vendor extraction
  const vendorPatterns = [
    /(?:from|vendor|company)[:\s]+([A-Za-z\s&,.\-'()]{3,50})/i,
    /^([A-Za-z\s&,.\-'()]{5,50})/m,
  ];
  
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim().replace(/[:\n\r]+$/, '');
      if (vendor.length > 2 && vendor.length < 50) {
        result.vendor = vendor;
        break;
      }
    }
  }
  
  // Simple total extraction
  const totalPatterns = [
    /(?:total|amount)[:\s]+\$?\s*([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.\d{2})/,
  ];
  
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