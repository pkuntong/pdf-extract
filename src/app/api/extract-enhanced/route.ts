import { NextRequest, NextResponse } from 'next/server';
import { ExtractionResult } from '@/types/extraction';
import { getAvailablePatterns, extractDataWithPatterns } from '@/lib/extraction-patterns';

export async function GET() {
  return NextResponse.json({ 
    message: 'Enhanced PDF extraction API with premium patterns.',
    availablePatterns: getAvailablePatterns(true).map(p => ({
      name: p.name,
      description: p.description,
      premium: p.premium || false
    }))
  });
}

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

function detectDocumentType(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Check for specific document types
  if (lowerText.includes('purchase order') || lowerText.includes('po number')) {
    return 'Purchase Order';
  }
  if (lowerText.includes('contract') || lowerText.includes('agreement')) {
    return 'Contract';
  }
  if (lowerText.includes('bank statement') || lowerText.includes('account balance')) {
    return 'Bank Statement';
  }
  if (lowerText.includes('receipt') && !lowerText.includes('invoice')) {
    return 'Receipt';
  }
  
  // Default to invoice
  return 'Standard Invoice';
}

function enhancedExtractData(text: string, filename: string, isPremium: boolean = false): ExtractionResult {
  try {
    // Detect document type
    const documentType = detectDocumentType(text);
    
    // Get available patterns based on subscription
    const availablePatterns = getAvailablePatterns(isPremium);
    
    // Find the matching pattern
    const pattern = availablePatterns.find(p => p.name === documentType) || 
                   availablePatterns.find(p => p.name === 'Standard Invoice');
    
    if (!pattern) {
      throw new Error('No extraction pattern available');
    }
    
    // Extract data using the pattern
    const result = extractDataWithPatterns(text, [pattern], filename);
    
    // Add metadata
    result.documentType = documentType;
    result.extractionPattern = pattern.name;
    
    return result;
  } catch (error) {
    return {
      filename,
      error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Simulate user subscription check (replace with real auth)
function getUserSubscription(request: NextRequest): { isPremium: boolean; plan: string } {
  // In a real app, you'd check auth headers/cookies and query your database
  const userAgent = request.headers.get('user-agent') || '';
  
  // For demo purposes, simulate premium for specific user agents
  const isPremium = userAgent.includes('Premium') || process.env.NODE_ENV === 'development';
  
  return {
    isPremium,
    plan: isPremium ? 'premium' : 'free'
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get user subscription info
    const { isPremium, plan } = getUserSubscription(request);
    
    // Check content length for mobile optimization
    const contentLength = request.headers.get('content-length');
    const maxSize = isPremium ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for premium, 10MB for free
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return NextResponse.json(
        { error: `Files too large. Maximum size is ${maxSize / 1024 / 1024}MB for ${plan} plan.` },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Check file limits based on subscription
    const maxFiles = isPremium ? 50 : 5;
    if (files.length > maxFiles) {
      return NextResponse.json({ 
        error: `Maximum ${maxFiles} files allowed for ${plan} plan. Upgrade to process more files.` 
      }, { status: 400 });
    }
    
    const extractions: ExtractionResult[] = [];
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      
      if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `Error: ${file.name || 'Unknown file'} is not a PDF file`
        });
        continue;
      }

      const maxFileSize = isPremium ? 50 * 1024 * 1024 : 2 * 1024 * 1024; // 50MB for premium, 2MB for free
      if (file.size > maxFileSize) {
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `Error: ${file.name || 'Unknown file'} is too large (max ${maxFileSize / 1024 / 1024}MB for ${plan} plan)`
        });
        continue;
      }
      
      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Extract text using pdfjs-dist
        const text = await extractTextFromPDF(arrayBuffer);
        
        // Use enhanced extraction with premium patterns
        const extractedData = enhancedExtractData(text, file.name || 'Unknown file', isPremium);
        extractions.push(extractedData);
      } catch (error) {
        console.error(`PDF processing error for ${file.name || 'Unknown file'}:`, error);
        extractions.push({
          filename: file.name || 'Unknown file',
          error: `Error processing ${file.name || 'Unknown file'}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    // Add processing metadata
    const response = {
      extractions,
      metadata: {
        totalFiles: files.length,
        processedFiles: processedCount,
        successfulExtractions: extractions.filter(e => !e.error).length,
        userPlan: plan,
        isPremium,
        timestamp: new Date().toISOString(),
        availablePatterns: getAvailablePatterns(isPremium).map(p => ({
          name: p.name,
          description: p.description
        }))
      }
    };
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Total-Files': files.length.toString(),
        'X-Successful-Extractions': extractions.filter(e => !e.error).length.toString(),
        'X-User-Plan': plan,
      }
    });
  } catch (error) {
    console.error('API Error:', error);
    
    // More specific error messages
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