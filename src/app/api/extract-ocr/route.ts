import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for OCR processing
// Configure larger body size limit for file uploads
export const preferredRegion = 'auto';

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

// Direct image OCR extraction
async function extractTextFromImageWithOCR(arrayBuffer: ArrayBuffer, filename: string): Promise<string> {
  try {
    console.log(`Starting direct image OCR for ${filename}...`);
    
    const OCR_TIMEOUT_MS = 25000;
    const { createWorker } = await import('tesseract.js');
    
    const worker = await createWorker('eng');
    
    try {
      // Convert ArrayBuffer to base64 data URL for Tesseract
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = Buffer.from(uint8Array).toString('base64');
      const mimeType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const imageData = `data:${mimeType};base64,${base64}`;
      
      console.log(`🔍 Processing OCR for image ${filename}...`);
      
      const ocrPromise = (async () => {
        const result = await worker.recognize(imageData);
        
        if (!result.data.text || !result.data.text.trim()) {
          throw new Error('OCR could not extract any readable text from image');
        }
        
        console.log(`✅ Image OCR successful for ${filename} (${result.data.text.length} chars)`);
        return result.data.text.trim();
      })();

      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS);
      });

      return await Promise.race([ocrPromise, timeoutPromise]);
      
    } finally {
      await worker.terminate();
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Image OCR failed for ${filename}:`, errorMessage);
    throw new Error(`Image OCR failed: ${errorMessage}`);
  }
}

// OCR extraction using Tesseract.js
async function performOCRExtraction(arrayBuffer: ArrayBuffer, filename: string): Promise<string> {
  try {
    const OCR_TIMEOUT_MS = 25000;
    // Import Tesseract.js dynamically
    const { createWorker } = await import('tesseract.js');
    
    // Configure Tesseract for server environment
    const worker = await createWorker('eng');
    
    let pdfImages: string[] = [];
    
    // Try to convert PDF to images first
    try {
      pdfImages = await convertPDFToImages(arrayBuffer);
    } catch (conversionError) {
      console.warn(`PDF conversion failed for ${filename}, trying alternative OCR approach...`);
      
      // If PDF.js fails completely, try alternative PDF-to-image conversion
      try {
        console.log(`🔍 Attempting alternative PDF conversion for ${filename}...`);
        pdfImages = await convertPDFToImagesAlternative(arrayBuffer, filename);
        console.log(`✅ Alternative conversion successful for ${filename} (${pdfImages.length} images)`);
      } catch (alternativeError) {
        console.warn(`Alternative PDF conversion also failed for ${filename}:`, alternativeError);
        
        // If this PDF has the "Object.defineProperty called on non-object" error,
        // it's likely a corrupted or password-protected PDF that can't be processed
        const errorMessage = alternativeError instanceof Error ? alternativeError.message : 'Unknown error';
        if (errorMessage.includes('Object.defineProperty called on non-object')) {
          throw new Error('PDF file appears to be corrupted, password-protected, or in an unsupported format. Please try:\n1. Converting the PDF to images (PNG/JPG) and uploading those instead\n2. Using a different PDF extraction tool to repair the file\n3. Exporting the document to a new PDF format');
        }
        
        throw new Error('All PDF conversion methods failed - file may be corrupted or in unsupported format');
      }
    }
    
    if (!pdfImages || pdfImages.length === 0) {
      throw new Error('Failed to convert PDF to images for OCR');
    }
    
    console.log(`📸 Converted ${filename} to ${pdfImages.length} image(s) for OCR`);
    
    let allText = '';
    // For responsiveness, OCR only the first page at a time by default
    const maxImages = Math.min(pdfImages.length, 1);
    
    try {
      const ocrPromise = (async () => {
        for (let i = 0; i < maxImages; i++) {
          try {
            console.log(`🔍 Processing OCR for page ${i + 1}/${maxImages}...`);
            const result = await worker.recognize(pdfImages[i]);
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
      })();

      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS);
      });

      return await Promise.race([ocrPromise, timeoutPromise]);
    } finally {
      // Always clean up worker
      await worker.terminate();
    }
    
  } catch (error) {
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Alternative PDF to image conversion - simplified fallback without pdf2pic
async function convertPDFToImagesAlternative(arrayBuffer: ArrayBuffer, filename: string): Promise<string[]> {
  try {
    // Since pdf2pic has issues with buffer handling in server environment,
    // we'll try a simpler approach using PDF.js with different settings
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    if (typeof window === 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }

    const uint8Array = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({
      data: uint8Array,
      verbosity: 0,
      disableAutoFetch: false,  // Different settings from main function
      disableStream: false,
      disableFontFace: false,
      useSystemFonts: true,
      stopAtErrors: true
    }).promise;

    const images: string[] = [];
    const maxPages = Math.min(pdf.numPages, 2); // Limit for performance
    
    console.log(`Alternative conversion: Processing ${maxPages} pages from ${filename}...`);

    for (let i = 1; i <= maxPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.2 }); // Lower resolution for fallback
        
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
        
        // Convert canvas to base64 image (avoid filename parameter)
        const imageData = canvas.toDataURL();
        images.push(imageData);
        
        console.log(`✅ Alternative converted page ${i} from ${filename}`);
        
      } catch (pageError) {
        console.warn(`Alternative conversion failed for page ${i}:`, pageError);
        continue;
      }
    }
    
    if (images.length === 0) {
      throw new Error('Alternative conversion could not convert any pages');
    }
    
    console.log(`✅ Alternative conversion successful for ${filename} (${images.length} images)`);
    return images;
    
  } catch (error) {
    console.warn(`Alternative PDF conversion failed for ${filename}:`, error);
    throw new Error(`Alternative PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        const viewport = page.getViewport({ scale: 1.5 }); // Lower to speed up OCR
        
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
        
        // Convert canvas to base64 image (avoid filename parameter)
        const imageData = canvas.toDataURL();
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
    message: 'OCR-enhanced PDF extraction API endpoint. Use POST to extract data from PDFs or images.',
    note: 'This version includes OCR fallback for scanned PDFs and direct image OCR using Tesseract.js',
    features: [
      'Standard PDF text extraction',
      'OCR fallback for scanned documents',
      'Direct image OCR (PNG, JPG, etc.)',
      'Line item detection',
      'Invoice data parsing'
    ],
    supportedFormats: ['PDF', 'PNG', 'JPG', 'JPEG', 'GIF', 'BMP', 'WEBP']
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
      const fileName = file.name || 'Unknown file';
      const fileType = file.type;
      const isImage = fileType.startsWith('image/') || 
        fileName.toLowerCase().match(/\.(png|jpg|jpeg|gif|bmp|webp)$/);
      const isPDF = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
      
      if (!isPDF && !isImage) {
        extractions.push({
          filename: fileName,
          error: `File must be a PDF or image (PNG, JPG, etc.)`
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit for OCR (due to Next.js constraints)
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `File too large for OCR processing (max 10MB)`
        });
        continue;
      }
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        let text: string;
        if (isImage) {
          // Direct image OCR processing
          text = await extractTextFromImageWithOCR(arrayBuffer, fileName);
        } else {
          // PDF processing with OCR fallback
          text = await extractTextFromPDFWithOCR(arrayBuffer, fileName);
        }
        
        const extractedData = extractInvoiceData(text, fileName);
        
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