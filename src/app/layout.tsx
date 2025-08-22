import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { FeedbackWidget } from "@/components/FeedbackWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PDF Extract Pro - AI-Powered PDF Data Extraction Tool",
    template: "%s | PDF Extract Pro"
  },
  description: "Extract invoice data from PDFs with AI precision. Automate your document processing with bulk processing, OCR, line item extraction, and CSV export. Perfect for accounting and bookkeeping.",
  keywords: [
    "PDF extraction", "invoice data extraction", "AI PDF processing", "PDF to CSV", 
    "document automation", "invoice OCR", "receipt processing", "accounting software",
    "bookkeeping tools", "financial document processing", "bulk PDF processing",
    "invoice parsing", "data extraction API", "PDF text extraction", "mobile PDF scanner"
  ],
  authors: [{ name: "PDF Extract Pro", url: "https://pdf-extract.pro" }],
  creator: "PDF Extract Pro",
  publisher: "PDF Extract Pro",
  applicationName: "PDF Extract Pro",
  generator: "Next.js",
  category: "productivity",
  classification: "Business Software",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "PDF Extract Pro",
    title: "PDF Extract Pro - AI-Powered PDF Data Extraction Tool",
    description: "Extract invoice data from PDFs with AI precision. Automate document processing with bulk processing, OCR, and CSV export. Perfect for accounting and bookkeeping.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PDF Extract Pro - AI-Powered PDF Data Extraction",
        type: "image/png",
      },
      {
        url: "/og-image-square.png",
        width: 1080,
        height: 1080,
        alt: "PDF Extract Pro Logo",
        type: "image/png",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@pdfextractpro",
    creator: "@pdfextractpro",
    title: "PDF Extract Pro - AI-Powered PDF Data Extraction Tool",
    description: "Extract invoice data from PDFs with AI precision. Automate document processing with bulk processing, OCR, and CSV export.",
    images: ["/twitter-image.png"],
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    bing: process.env.BING_VERIFICATION,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PDF Extract Pro",
    startupImage: [
      {
        url: "/splash-640x1136.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash-750x1294.png", 
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      {
        url: "/splash-1242x2148.png",
        media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash-1125x2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/splash-1536x2048.png",
        media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  icons: [
    { rel: "icon", url: "/favicon.ico", sizes: "any" },
    { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/icon-192x192.png", sizes: "192x192" },
    { rel: "mask-icon", url: "/icon-512x512.png", color: "#1e40af" },
  ],
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "format-detection": "telephone=no",
    "msapplication-TileColor": "#1e40af",
    "msapplication-config": "/browserconfig.xml",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e40af" },
    { media: "(prefers-color-scheme: dark)", color: "#1e40af" },
  ],
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "PDF Extract Pro",
    "applicationCategory": "BusinessApplication",
    "applicationSubCategory": "Document Processing",
    "operatingSystem": "Any",
    "url": "/",
    "description": "AI-powered PDF data extraction tool for invoices, receipts, and business documents. Extract structured data and export to CSV with high accuracy.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "description": "Free plan available with premium upgrades"
    },
    "featureList": [
      "AI-powered data extraction",
      "OCR for scanned documents", 
      "Bulk PDF processing",
      "CSV export functionality",
      "Mobile-optimized interface",
      "Offline processing capability",
      "Invoice and receipt parsing",
      "Line item extraction"
    ],
    "author": {
      "@type": "Organization",
      "name": "PDF Extract Pro"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1247",
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <SubscriptionProvider>
            {children}
            <FeedbackWidget />
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
