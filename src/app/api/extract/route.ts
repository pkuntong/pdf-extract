import { NextRequest, NextResponse } from 'next/server';
import { ExtractionResult } from '@/types/extraction';

// Dynamic import for PDF.js to work in Node.js environment
let pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null;

async function initPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Configure worker for server-side usage
    if (typeof window === 'undefined') {
      // Server-side: disable worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    } else {
      // Client-side: use CDN worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
  }
  return pdfjsLib;
}


async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    if (arrayBuffer.byteLength === 0) {
      throw new Error('PDF file is empty');
    }
    
    const pdfjs = await initPdfJs();
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await pdfjs.getDocument({ 
      data: uint8Array,
      verbosity: 0 // Reduce console noise
    }).promise;
    
    if (pdf.numPages === 0) {
      throw new Error('PDF has no pages');
    }
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => {
            if ('str' in item) {
              return (item as { str: string }).str;
            }
            return '';
          })
          .filter((text: string) => text.trim().length > 0)
          .join(' ');
        fullText += pageText + '\n';
      } catch (pageError) {
        console.warn(`Failed to extract text from page ${i}:`, pageError);
        continue;
      }
    }
    
    if (fullText.trim().length === 0) {
      throw new Error('No text content found in PDF');
    }
    
    return fullText;
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractInvoiceData(text: string, filename: string): ExtractionResult {
  const result: ExtractionResult = { filename };
  
  // Multiple patterns for invoice numbers
  const invoicePatterns = [
    /(?:invoice\s*(?:number|#|no\.?)?|inv\s*(?:number|#|no\.?)?|bill\s*(?:number|#|no\.?)?)\s*:?\s*([A-Z0-9\-_]+)/i,
    /(?:^|\s)([A-Z]{2,3}-?\d{4,})/m, // Pattern like ABC-1234 or ABC1234
    /#\s*([A-Z0-9\-_]{3,})/i, // Pattern like #INV123
  ];
  
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.invoiceNumber = match[1].trim();
      break;
    }
  }
  
  // Multiple patterns for dates
  const datePatterns = [
    /(?:date|invoice\s*date|issued|bill\s*date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /(?:date|invoice\s*date|issued|bill\s*date)\s*:?\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
    /(?:date|invoice\s*date|issued|bill\s*date)\s*:?\s*(\w{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/, // Any date format
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result.date = match[1].trim();
      break;
    }
  }
  
  // Multiple patterns for vendor/company
  const vendorPatterns = [
    /(?:from|vendor|company|bill\s*to|sold\s*by)\s*:?\s*([A-Za-z\s&,.\-'()]+?)(?:\n|$|\s{2,})/i,
    /^([A-Za-z\s&,.\-'()]{3,})\s*(?:\n|\r)/m, // First line that looks like a company name
    /(?:^|\n)\s*([A-Z][A-Za-z\s&,.\-'()]{5,}?)\s*(?:\n|Address|Phone|Email|Tax)/i,
  ];
  
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim().replace(/[:\n\r]+$/, '');
      if (vendor.length > 2 && vendor.length < 100) {
        result.vendor = vendor;
        break;
      }
    }
  }
  
  // Multiple patterns for total amount
  const totalPatterns = [
    /(?:total|grand\s*total|amount\s*due|balance\s*due|final\s*amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /(?:total|grand\s*total|amount\s*due|balance\s*due)\s*\$?\s*([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.\d{2})(?:\s|$)/, // Any currency amount
    /(?:^|\s)([\d,]+\.\d{2})\s*$$/m, // End of line amount
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

export async function POST(request: NextRequest) {
  try {
    // Check content length for mobile optimization
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB limit
      return NextResponse.json(
        { error: 'Files too large. Maximum total size is 50MB.' },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 files allowed' }, { status: 400 });
    }
    
    const extractions: ExtractionResult[] = [];
    let processedCount = 0;
    
    for (const file of files) {
      // Add progress for mobile feedback
      processedCount++;
      
      if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `Error: ${file.name || 'Unknown file'} is not a PDF file`
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB per file limit
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `Error: ${file.name || 'Unknown file'} is too large (max 10MB per file)`
        });
        continue;
      }
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Extract text using pdfjs-dist
        const text = await extractTextFromPDF(arrayBuffer);
        const extractedData = extractInvoiceData(text, file.name || 'Unknown file');
        extractions.push(extractedData);
      } catch (error) {
        console.error(`PDF processing error for ${file.name || 'Unknown file'}:`, error);
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `Error processing ${file.name || 'Unknown file'}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    // Add processing metadata for mobile optimization
    const response = {
      extractions,
      metadata: {
        totalFiles: files.length,
        processedFiles: processedCount,
        successfulExtractions: extractions.filter(e => !e.error).length,
        timestamp: new Date().toISOString(),
      }
    };
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Total-Files': files.length.toString(),
        'X-Successful-Extractions': extractions.filter(e => !e.error).length.toString(),
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    
    // More specific error messages for mobile users
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('PDF parsing failed')) {
        errorMessage = 'Unable to read PDF files. Please ensure they are not corrupted or password-protected.';
        statusCode = 422;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Processing took too long. Please try with smaller files.';
        statusCode = 408;
      } else if (error.message.includes('memory')) {
        errorMessage = 'Files too complex to process. Please try with simpler PDFs.';
        statusCode = 413;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      },
      { status: statusCode }
    );
  }
}