import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Pricing Plans - PDF Extract Pro",
  description: "Choose the perfect plan for your PDF extraction needs. Free plan available with premium upgrades for bulk processing, advanced features, and priority support.",
  keywords: [
    "PDF extraction pricing", "document processing plans", "invoice extraction cost",
    "PDF to CSV pricing", "bulk document processing", "accounting software pricing",
    "PDF data extraction subscription", "document automation pricing"
  ],
  openGraph: {
    title: "Pricing Plans - PDF Extract Pro", 
    description: "Choose the perfect plan for your PDF extraction needs. Free plan available with premium upgrades.",
    url: "/pricing",
    images: [
      {
        url: "/og-pricing.png",
        width: 1200,
        height: 630,
        alt: "PDF Extract Pro Pricing Plans",
      }
    ],
  },
  twitter: {
    title: "Pricing Plans - PDF Extract Pro",
    description: "Choose the perfect plan for your PDF extraction needs. Free plan available with premium upgrades.",
    images: ["/twitter-pricing.png"],
  },
  alternates: {
    canonical: "/pricing",
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}