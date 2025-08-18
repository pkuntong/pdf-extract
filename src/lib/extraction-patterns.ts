export interface ExtractionPattern {
  name: string;
  description: string;
  patterns: {
    [key: string]: RegExp[];
  };
  premium?: boolean;
}

export const extractionPatterns: ExtractionPattern[] = [
  {
    name: 'Standard Invoice',
    description: 'Basic invoice data extraction',
    patterns: {
      invoiceNumber: [
        /(?:invoice\s*(?:number|#|no\.?)?|inv\s*(?:number|#|no\.?)?|bill\s*(?:number|#|no\.?)?)\s*:?\s*([A-Z0-9\-_]+)/i,
        /(?:^|\s)([A-Z]{2,3}-?\d{4,})/m,
        /#\s*([A-Z0-9\-_]{3,})/i,
      ],
      date: [
        /(?:date|invoice\s*date|issued|bill\s*date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
        /(?:date|invoice\s*date|issued|bill\s*date)\s*:?\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
        /(?:date|invoice\s*date|issued|bill\s*date)\s*:?\s*(\w{3,9}\s+\d{1,2},?\s+\d{4})/i,
      ],
      vendor: [
        /(?:from|vendor|company|bill\s*to|sold\s*by)\s*:?\s*([A-Za-z\s&,.\-'()]+?)(?:\n|$|\s{2,})/i,
        /^([A-Za-z\s&,.\-'()]{3,})\s*(?:\n|\r)/m,
      ],
      total: [
        /(?:total|grand\s*total|amount\s*due|balance\s*due|final\s*amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.\d{2})(?:\s|$)/,
      ]
    }
  },
  {
    name: 'Receipt',
    description: 'Retail receipt extraction',
    premium: true,
    patterns: {
      merchant: [
        /^([A-Z\s&]+)$/m,
        /(?:merchant|store|retailer)\s*:?\s*([A-Za-z\s&,.\-'()]+)/i,
      ],
      total: [
        /(?:total|amount|sum)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        /\$\s*([\d,]+\.\d{2})(?:\s*$)/m,
      ],
      date: [
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
        /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      ],
      items: [
        /^(.+?)\s+\$?([\d,]+\.?\d*)$/gm,
      ]
    }
  },
  {
    name: 'Purchase Order',
    description: 'Business purchase order extraction',
    premium: true,
    patterns: {
      poNumber: [
        /(?:purchase\s*order|po\s*(?:number|#|no\.?))\s*:?\s*([A-Z0-9\-_]+)/i,
        /(?:^|\s)(PO-?[A-Z0-9\-_]+)/m,
      ],
      vendor: [
        /(?:vendor|supplier|from)\s*:?\s*([A-Za-z\s&,.\-'()]+?)(?:\n|$|\s{2,})/i,
      ],
      total: [
        /(?:total|grand\s*total|amount)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
      ],
      deliveryDate: [
        /(?:delivery\s*date|ship\s*date|expected)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      ]
    }
  },
  {
    name: 'Contract',
    description: 'Legal contract extraction',
    premium: true,
    patterns: {
      contractNumber: [
        /(?:contract\s*(?:number|#|no\.?)|agreement\s*(?:number|#|no\.?))\s*:?\s*([A-Z0-9\-_]+)/i,
      ],
      parties: [
        /(?:between|party\s*a|first\s*party)\s*:?\s*([A-Za-z\s&,.\-'()]+?)(?:\n|and|$)/i,
        /(?:and|party\s*b|second\s*party)\s*:?\s*([A-Za-z\s&,.\-'()]+?)(?:\n|$)/i,
      ],
      effectiveDate: [
        /(?:effective\s*date|start\s*date|commenced)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      ],
      amount: [
        /(?:amount|value|consideration)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
      ]
    }
  },
  {
    name: 'Bank Statement',
    description: 'Bank statement transaction extraction',
    premium: true,
    patterns: {
      accountNumber: [
        /(?:account\s*(?:number|#|no\.?))\s*:?\s*([A-Z0-9\-_]+)/i,
      ],
      balance: [
        /(?:balance|available\s*balance)\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
      ],
      statementDate: [
        /(?:statement\s*date|as\s*of)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
      ],
      transactions: [
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+([\-+]?\$?[\d,]+\.?\d*)/gm,
      ]
    }
  }
];

export function getAvailablePatterns(isPremium: boolean = false): ExtractionPattern[] {
  return extractionPatterns.filter(pattern => !pattern.premium || isPremium);
}

export function extractDataWithPatterns(
  text: string, 
  patterns: ExtractionPattern[],
  filename: string
): Record<string, unknown> {
  const result: Record<string, unknown> = { filename };

  for (const pattern of patterns) {
    for (const [field, regexList] of Object.entries(pattern.patterns)) {
      if (result[field]) continue; // Skip if already found

      for (const regex of regexList) {
        const match = text.match(regex);
        if (match && match[1]) {
          if (field === 'total' || field === 'amount' || field === 'balance') {
            const cleanAmount = match[1].replace(/,/g, '');
            if (parseFloat(cleanAmount) > 0) {
              result[field] = cleanAmount;
              break;
            }
          } else if (field === 'vendor' || field === 'merchant' || field === 'parties') {
            const cleanValue = match[1].trim().replace(/[:\n\r]+$/, '');
            if (cleanValue.length > 2 && cleanValue.length < 100) {
              result[field] = cleanValue;
              break;
            }
          } else {
            result[field] = match[1].trim();
            break;
          }
        }
      }
    }
  }

  return result;
}