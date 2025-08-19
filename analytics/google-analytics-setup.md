# 📊 Analytics Setup Guide for PDF Extract Pro

## Google Analytics 4 Setup

### 1. Create GA4 Property
1. Go to [Google Analytics](https://analytics.google.com)
2. Create new property: "PDF Extract Pro"
3. Select "Web" and add your domain
4. Copy Measurement ID (G-XXXXXXXXXX)

### 2. Add to Next.js App
Add to `src/lib/analytics.ts`:

```typescript
import { GoogleAnalytics } from '@next/third-parties/google'

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID

// Track page views
export const pageview = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    })
  }
}

// Track custom events
export const event = ({
  action,
  category,
  label,
  value,
}: {
  action: string
  category: string
  label?: string
  value?: number
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}
```

Add to `src/app/layout.tsx`:
```tsx
import { GoogleAnalytics } from '@next/third-parties/google'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
      </body>
    </html>
  )
}
```

### 3. Track Key Events

Add to your components:

```typescript
import { event } from '@/lib/analytics'

// Track PDF uploads
const handleFileUpload = () => {
  event({
    action: 'upload_pdf',
    category: 'engagement',
    label: 'file_upload'
  })
}

// Track extractions
const handleExtraction = (success: boolean) => {
  event({
    action: success ? 'extraction_success' : 'extraction_failed',
    category: 'core_feature',
    label: 'pdf_extraction'
  })
}

// Track upgrades
const handleUpgrade = (plan: string) => {
  event({
    action: 'upgrade',
    category: 'conversion',
    label: plan,
    value: plan === 'pro' ? 999 : 2999 // Price in cents
  })
}

// Track exports
const handleExport = (format: string) => {
  event({
    action: 'export_data',
    category: 'engagement',
    label: format
  })
}
```

### 4. Set Up Enhanced Ecommerce

In GA4 Admin → Events → Create Custom Event:

**Purchase Event (for subscriptions):**
```javascript
gtag('event', 'purchase', {
  transaction_id: 'sub_123456',
  value: 9.99,
  currency: 'USD',
  items: [{
    item_id: 'pro_plan',
    item_name: 'PDF Extract Pro Plan',
    category: 'subscription',
    quantity: 1,
    price: 9.99
  }]
})
```

### 5. Goals & Conversions Setup

In GA4 Admin → Conversions, mark these events as conversions:
- `sign_up` - User registration
- `purchase` - Subscription purchase
- `upload_pdf` - Core feature usage
- `export_data` - Feature completion

### 6. Custom Dimensions

Add these custom dimensions in GA4:
- `user_plan` - free/pro/business
- `extraction_type` - simple/enhanced/ocr
- `file_count` - number of files processed
- `user_type` - new/returning

## Google Search Console Setup

### 1. Verify Your Domain
1. Go to [Search Console](https://search.google.com/search-console)
2. Add property with your domain
3. Verify via DNS TXT record or HTML file

### 2. Submit Sitemap
Create `src/app/sitemap.ts`:

```typescript
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://your-domain.com'
  
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/auth`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ]
}
```

Submit sitemap: `https://your-domain.com/sitemap.xml`

## PostHog Setup (Product Analytics)

### 1. Create PostHog Account
1. Sign up at [PostHog](https://posthog.com)
2. Create new project
3. Copy API key

### 2. Install and Configure
```bash
npm install posthog-js
```

Create `src/lib/posthog.ts`:
```typescript
import posthog from 'posthog-js'

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://app.posthog.com'
  })
}

export default posthog
```

### 3. Track User Journey
```typescript
import posthog from '@/lib/posthog'

// Track user properties
posthog.identify(user.id, {
  email: user.email,
  plan: subscription.plan,
  signup_date: user.created_at
})

// Track feature usage
posthog.capture('pdf_uploaded', {
  file_size: file.size,
  file_type: file.type,
  user_plan: subscription.plan
})

// Track conversion funnel
posthog.capture('upgrade_clicked', {
  from_plan: 'free',
  to_plan: 'pro',
  page: '/pricing'
})
```

## Hotjar Setup (User Behavior)

### 1. Create Hotjar Account
1. Sign up at [Hotjar](https://hotjar.com)
2. Add new site
3. Copy tracking code

### 2. Add to Next.js
Add to `src/app/layout.tsx`:

```tsx
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <Script id="hotjar" strategy="afterInteractive">
          {`
            (function(h,o,t,j,a,r){
                h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                h._hjSettings={hjid:${process.env.NEXT_PUBLIC_HOTJAR_ID},hjsv:6};
                a=o.getElementsByTagName('head')[0];
                r=o.createElement('script');r.async=1;
                r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
          `}
        </Script>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
```

### 3. Set Up Heatmaps and Recordings
In Hotjar dashboard:
- Enable recordings for all pages
- Set up heatmaps for key pages (/, /pricing, /dashboard)
- Create funnels for signup → trial → purchase

## Environment Variables
Add to `.env.local` and Vercel:

```env
# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx
NEXT_PUBLIC_HOTJAR_ID=1234567

# Monitoring (covered in monitoring setup)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

## Key Metrics Dashboard

### Launch Day KPIs
- Unique visitors
- Trial signups
- Conversion rate (visitor → signup)
- Time on site
- Page views per session
- Social media referrals
- Product Hunt traffic

### Weekly KPIs
- Monthly Active Users (MAU)
- Trial → Paid conversion rate
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Churn rate
- Feature adoption rate
- Support ticket volume

### Custom Reports to Create

1. **Conversion Funnel**
   - Landing page views
   - Trial signups
   - First PDF upload
   - First extraction
   - Upgrade to paid

2. **Feature Usage**
   - PDF uploads by plan type
   - Extraction success rate
   - Export format preferences
   - Mobile vs desktop usage

3. **User Segmentation**
   - New vs returning users
   - Free vs paid users
   - High-usage vs low-usage users
   - Geographic distribution

4. **Revenue Metrics**
   - MRR growth
   - Average revenue per user (ARPU)
   - Customer lifetime value (CLV)
   - Churn rate by cohort