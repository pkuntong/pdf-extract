import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { ExtractionResult, LineItem } from '@/types/extraction';

// Enhanced PDF text extraction with OCR fallback
async function extractTextFromPDFWithOCR(arrayBuffer: ArrayBuffer, filename: string): Promise<string> {
  try {
    console.log(`Starting OCR-enhanced extraction for ${filename}...`);
    
    // First, try the standard PDF text extraction (same as extract-simple)
    try {
      const textResult = await extractTextFromPDF(arrayBuffer);
      if (textResult && textResult.trim().length > 50) {
        console.log(`✅ Standard PDF extraction successful for ${filename} (${textResult.length} chars)`);
        return textResult;
      }
    } catch (pdfError) {
      console.log(`⚠️ Standard PDF extraction failed for ${filename}, trying OCR...`);
    }
    
    // If standard extraction fails or returns minimal text, use OCR
    console.log(`🔍 Performing OCR extraction for ${filename}...`);
    const ocrText = await performOCRExtraction(arrayBuffer, filename);
    
    if (!ocrText || ocrText.trim().length < 20) {
      throw new Error('OCR extraction failed to find readable text');
    }
    
    console.log(`✅ OCR extraction successful for ${filename} (${ocrText.length} chars)`);
    return ocrText;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ All extraction methods failed for ${filename}:`, errorMessage);
    throw new Error(`Extraction failed: ${errorMessage}`);
  }
}

// Standard PDF text extraction with fallback (same as extract-simple)
async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('PDF file is empty');
    }

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    if (typeof window === 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }

    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({
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
    const maxPages = Math.min(pdf.numPages, 10); // Limit for performance
    
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
  } catch (error) {
    // Fallback to pdf-parse (debugging disabled fork) for better compatibility
    try {
      const buffer = Buffer.from(arrayBuffer);
      const pdfParse = (await import('pdf-parse-debugging-disabled')).default;
      const result = await pdfParse(buffer, { max: 10 });
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

// OCR extraction using Tesseract.js
async function performOCRExtraction(arrayBuffer: ArrayBuffer, filename: string): Promise<string> {
  try {
    // Import Tesseract.js dynamically
    const Tesseract = await import('tesseract.js');
    
    let pdfImages: string[] = [];
    
    // Try to convert PDF to images first
    try {
      pdfImages = await convertPDFToImages(arrayBuffer);
    } catch (conversionError) {
      console.warn(`PDF conversion failed for ${filename}, trying alternative OCR approach...`);
      
      // If PDF.js fails completely, try processing the PDF directly with Tesseract
      // This works for some scanned PDFs that Tesseract can handle directly
      try {
        console.log(`🔍 Attempting direct OCR on PDF buffer for ${filename}...`);
        const result = await Tesseract.recognize(Buffer.from(arrayBuffer), 'eng', {
          logger: () => {}, // Disable verbose logging
        });
        
        if (result.data.text && result.data.text.trim().length > 20) {
          console.log(`✅ Direct PDF OCR successful for ${filename} (${result.data.text.length} chars)`);
          return result.data.text.trim();
        }
      } catch (directOCRError) {
        console.warn(`Direct PDF OCR also failed for ${filename}:`, directOCRError);
      }
      
      throw new Error('Could not convert PDF to images and direct OCR failed');
    }
    
    if (!pdfImages || pdfImages.length === 0) {
      throw new Error('Failed to convert PDF to images for OCR');
    }
    
    console.log(`📸 Converted ${filename} to ${pdfImages.length} image(s) for OCR`);
    
    let allText = '';
    const maxImages = Math.min(pdfImages.length, 5); // Limit for performance
    
    for (let i = 0; i < maxImages; i++) {
      try {
        console.log(`🔍 Processing OCR for page ${i + 1}/${maxImages}...`);
        
        const result = await Tesseract.recognize(pdfImages[i], 'eng', {
          logger: () => {}, // Disable verbose logging
        });
        
        if (result.data.text && result.data.text.trim()) {
          allText += result.data.text.trim() + '\n';
          console.log(`✅ OCR page ${i + 1}: ${result.data.text.length} chars extracted`);
        }
      } catch (pageOCRError) {
        console.warn(`Failed OCR for page ${i + 1}:`, pageOCRError);
        continue;
      }
    }
    
    if (!allText.trim()) {
      throw new Error('OCR could not extract any readable text');
    }
    
    return allText.trim();
    
  } catch (error) {
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Convert PDF to images for OCR using Canvas with fallback
async function convertPDFToImages(arrayBuffer: ArrayBuffer): Promise<string[]> {
  try {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('PDF file is empty');
    }

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    if (typeof window === 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }

    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({
      data: uint8Array,
      verbosity: 0,
      disableAutoFetch: true,
      disableStream: true,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false
    }).promise;

    const images: string[] = [];
    const maxPages = Math.min(pdf.numPages, 3); // Limit for OCR performance
    
    console.log(`Converting ${maxPages} pages to images for OCR...`);

    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Higher resolution for better OCR
        
        // Import canvas dynamically (Node.js environment)
        const { createCanvas } = await import('canvas');
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        
        // Render PDF page to canvas
        const renderContext = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvasContext: context as any,
          viewport: viewport,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvas: canvas as any,
        };
        
        await page.render(renderContext).promise;
        
        // Convert canvas to base64 image
        const imageData = canvas.toDataURL('image/png');
        images.push(imageData);
        
        console.log(`✅ Converted page ${i} to image (${viewport.width}x${viewport.height})`);
        
      } catch (pageError) {
        console.warn(`Failed to convert page ${i} to image:`, pageError);
        continue;
      }
    }
    
    if (images.length === 0) {
      throw new Error('No pages could be converted to images');
    }
    
    return images;
    
  } catch (error) {
    // If PDF.js fails, we can't convert to images for OCR
    // This happens with corrupted or incompatible PDF files
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Object.defineProperty called on non-object')) {
      throw new Error('PDF file format not supported for OCR image conversion');
    }
    throw new Error(`PDF to image conversion failed: ${message}`);
  }
}

// Same line item extraction as before
function extractLineItems(text: string): LineItem[] {
  const lineItems: LineItem[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const tablePatterns = [
    /^(.{10,50})\s+(\d+(?:\.\d{1,2})?)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)$/,
    /^(.{10,80})\s+\$?([\d,]+\.\d{2})$/,
    /^(\d+(?:\.\d{1,2})?)\s+(.{10,50})\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)$/,
  ];
  
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
    
    if (!inLineItemSection) {
      const hasTableHeaders = tableHeaders.some(header => header.test(line));
      if (hasTableHeaders) {
        inLineItemSection = true;
        continue;
      }
    }
    
    if (!inLineItemSection) continue;
    
    if (/^(subtotal|tax|total|notes?|payment|due|thank)/i.test(line)) {
      break;
    }
    
    for (const pattern of tablePatterns) {
      const match = line.match(pattern);
      if (match) {
        let lineItem: LineItem;
        
        if (match.length === 5) {
          lineItem = {
            description: match[1].trim(),
            quantity: parseFloat(match[2]),
            unitPrice: parseFloat(match[3].replace(/,/g, '')),
            amount: parseFloat(match[4].replace(/,/g, ''))
          };
        } else if (match.length === 4) {
          lineItem = {
            description: match[2].trim(),
            quantity: parseFloat(match[1]),
            unitPrice: parseFloat(match[3].replace(/,/g, '')),
            amount: parseFloat(match[4].replace(/,/g, ''))
          };
        } else if (match.length === 3) {
          lineItem = {
            description: match[1].trim(),
            amount: parseFloat(match[2].replace(/,/g, ''))
          };
        } else {
          continue;
        }
        
        if (lineItem.description && lineItem.description.length > 5 && 
            (lineItem.amount && lineItem.amount > 0)) {
          lineItems.push(lineItem);
          lineCount++;
          
          if (lineCount >= 20) break;
        }
        break;
      }
    }
  }
  
  return lineItems;
}

// Same invoice data extraction as before
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
    /(?:date)[:\s]+(\w{3,9}\s+\d{1,2},?\s+\d{4})/i,
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
    message: 'OCR-enhanced PDF extraction API endpoint. Use POST to extract data from PDFs.',
    note: 'This version includes OCR fallback for scanned PDFs using Tesseract.js',
    features: [
      'Standard PDF text extraction',
      'OCR fallback for scanned documents', 
      'Line item detection',
      'Invoice data parsing'
    ]
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > 3) {
      return NextResponse.json({ 
        error: 'Maximum 3 files allowed for OCR processing (performance limit)' 
      }, { status: 400 });
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

      if (file.size > 15 * 1024 * 1024) { // 15MB limit for OCR
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `File too large for OCR processing (max 15MB)`
        });
        continue;
      }
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractTextFromPDFWithOCR(arrayBuffer, file.name || 'Unknown file');
        const extractedData = extractInvoiceData(text, file.name || 'Unknown file');
        
        // Add OCR metadata
        extractedData.notes = extractedData.notes || '';
        if (text.length > 1000) {
          extractedData.notes += ' [OCR: High confidence]';
        } else if (text.length > 100) {
          extractedData.notes += ' [OCR: Medium confidence]';
        } else {
          extractedData.notes += ' [OCR: Low confidence]';
        }
        
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
        ocrProcessed: extractions.filter(e => e.notes?.includes('OCR:')).length,
        timestamp: new Date().toISOString(),
      }
    });
    
  } catch (error) {
    console.error('OCR API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during OCR processing' },
      { status: 500 }
    );
  }
}