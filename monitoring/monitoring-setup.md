# 🔍 Monitoring & Alerting Setup for PDF Extract Pro

## Uptime Monitoring with UptimeRobot

### 1. Create UptimeRobot Account
1. Sign up at [UptimeRobot](https://uptimerobot.com)
2. Free plan monitors up to 50 endpoints

### 2. Set Up Monitors

#### Website Monitors
```
Monitor 1: Homepage
- Type: HTTPS
- URL: https://your-domain.com
- Interval: 5 minutes
- Alert when down for: 1 minute

Monitor 2: Auth Page  
- Type: HTTPS
- URL: https://your-domain.com/auth
- Interval: 5 minutes

Monitor 3: API Health Check
- Type: HTTPS
- URL: https://your-domain.com/api/health
- Interval: 5 minutes
```

### 3. Create API Health Check
Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Check database connection
    const { data, error } = await supabase
      .from('subscriptions')
      .select('count')
      .limit(1)

    if (error) throw error

    // Check Stripe connection
    const stripeCheck = process.env.STRIPE_SECRET_KEY ? true : false

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        stripe: stripeCheck ? 'configured' : 'not configured',
        api: 'operational'
      },
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}
```

### 4. Set Up Alerts
Configure alerts to:
- Email: your-email@domain.com
- Slack: #alerts channel
- SMS: Your phone number (for critical only)

## Error Monitoring with Sentry

### 1. Create Sentry Project
1. Sign up at [Sentry](https://sentry.io)
2. Create new project for Next.js
3. Copy DSN

### 2. Install Sentry
```bash
npm install @sentry/nextjs
```

Create `sentry.client.config.js`:
```javascript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter out development errors
    if (event.environment === 'development') {
      return null
    }
    return event
  },
})
```

Create `sentry.server.config.js`:
```javascript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
})
```

Create `sentry.edge.config.js`:
```javascript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
})
```

### 3. Add Error Boundaries
Create `src/components/ErrorBoundary.tsx`:

```tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-4">
          We've been notified about this error and will fix it soon.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

### 4. Track Custom Errors
```typescript
import * as Sentry from '@sentry/nextjs'

// Track PDF processing errors
const handlePDFError = (error: Error, filename: string) => {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'pdf_processing')
    scope.setContext('file', {
      filename,
      size: file.size,
      type: file.type
    })
    Sentry.captureException(error)
  })
}

// Track payment errors
const handlePaymentError = (error: Error, userId: string, amount: number) => {
  Sentry.withScope((scope) => {
    scope.setTag('feature', 'payments')
    scope.setUser({ id: userId })
    scope.setContext('payment', {
      amount,
      currency: 'USD'
    })
    Sentry.captureException(error)
  })
}
```

## Performance Monitoring

### 1. Vercel Analytics
Enable in Vercel dashboard:
- Real User Monitoring (RUM)
- Core Web Vitals tracking
- Function performance metrics

### 2. Next.js Built-in Monitoring
Add to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  // Enable analytics
  analytical: {
    analyticsId: process.env.VERCEL_ANALYTICS_ID,
  },
}

module.exports = nextConfig
```

Create `src/instrumentation.ts`:
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
```

### 3. Custom Performance Tracking
```typescript
// Track API response times
const trackAPIPerformance = async (endpoint: string, operation: () => Promise<any>) => {
  const start = performance.now()
  
  try {
    const result = await operation()
    const duration = performance.now() - start
    
    // Send to analytics
    gtag('event', 'timing_complete', {
      name: endpoint,
      value: Math.round(duration)
    })
    
    return result
  } catch (error) {
    const duration = performance.now() - start
    
    // Track failed operations
    gtag('event', 'timing_complete', {
      name: `${endpoint}_error`,
      value: Math.round(duration)
    })
    
    throw error
  }
}
```

## Database Monitoring (Supabase)

### 1. Enable Supabase Monitoring
In Supabase Dashboard:
- Go to Settings → Database
- Enable "Realtime" for critical tables
- Set up connection pooling

### 2. Query Performance Monitoring
```sql
-- Create function to track slow queries
CREATE OR REPLACE FUNCTION track_slow_queries()
RETURNS void AS $$
BEGIN
  -- Log queries taking longer than 1 second
  PERFORM pg_stat_statements_reset();
END;
$$ LANGUAGE plpgsql;
```

### 3. Database Health Checks
```typescript
// Check database connectivity
export async function checkDatabaseHealth() {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('count')
      .limit(1)
    
    if (error) throw error
    
    return { status: 'healthy', latency: Date.now() }
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error.message,
      latency: null 
    }
  }
}
```

## Payment Monitoring (Stripe)

### 1. Stripe Dashboard Alerts
Set up alerts for:
- Failed payments
- High chargeback rate
- Webhook failures
- Unusual transaction patterns

### 2. Custom Payment Monitoring
```typescript
// Monitor payment success rates
export async function trackPaymentMetrics() {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
  
  const charges = await stripe.charges.list({
    limit: 100,
    created: {
      gte: Math.floor(Date.now() / 1000) - 86400 // Last 24 hours
    }
  })
  
  const successRate = charges.data.filter(c => c.status === 'succeeded').length / charges.data.length
  
  if (successRate < 0.95) { // Alert if success rate < 95%
    // Send alert to monitoring system
    await sendAlert({
      type: 'payment_success_rate_low',
      value: successRate,
      threshold: 0.95
    })
  }
}
```

## Slack/Discord Alerting

### 1. Create Slack Webhook
1. Go to [Slack API](https://api.slack.com)
2. Create app and incoming webhook
3. Copy webhook URL

### 2. Alert Function
Create `src/lib/alerts.ts`:

```typescript
interface Alert {
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  fields?: { title: string; value: string; short?: boolean }[]
}

export async function sendSlackAlert(alert: Alert) {
  if (!process.env.SLACK_WEBHOOK_URL) return
  
  const color = {
    error: 'danger',
    warning: 'warning', 
    info: '#36a3f7',
    success: 'good'
  }[alert.type]
  
  const payload = {
    attachments: [{
      color,
      title: alert.title,
      text: alert.message,
      fields: alert.fields,
      ts: Math.floor(Date.now() / 1000)
    }]
  }
  
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

// Usage examples
export const alerts = {
  serverError: (error: Error, context?: string) => 
    sendSlackAlert({
      type: 'error',
      title: '🚨 Server Error',
      message: `${error.message}${context ? ` (${context})` : ''}`,
      fields: [
        { title: 'Stack', value: error.stack?.substring(0, 500) || 'No stack trace', short: false }
      ]
    }),
    
  highErrorRate: (rate: number, threshold: number) =>
    sendSlackAlert({
      type: 'warning', 
      title: '⚠️ High Error Rate',
      message: `Error rate is ${(rate * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`,
      fields: [
        { title: 'Current Rate', value: `${(rate * 100).toFixed(2)}%`, short: true },
        { title: 'Threshold', value: `${(threshold * 100).toFixed(2)}%`, short: true }
      ]
    }),
    
  paymentFailed: (amount: number, customerEmail: string, error: string) =>
    sendSlackAlert({
      type: 'error',
      title: '💳 Payment Failed',
      message: `Payment of $${amount} failed for ${customerEmail}`,
      fields: [
        { title: 'Amount', value: `$${amount}`, short: true },
        { title: 'Customer', value: customerEmail, short: true },
        { title: 'Error', value: error, short: false }
      ]
    }),
    
  newSignup: (userEmail: string, plan: string) =>
    sendSlackAlert({
      type: 'success',
      title: '🎉 New User Signup',
      message: `New user signed up: ${userEmail} (${plan} plan)`,
      fields: [
        { title: 'Email', value: userEmail, short: true },
        { title: 'Plan', value: plan, short: true }
      ]
    })
}
```

## Status Page Setup

### 1. Create Status Page (StatusPage.io)
1. Sign up at [StatusPage.io](https://statuspage.io)
2. Configure components:
   - Website
   - API
   - Database
   - Payment Processing
   - PDF Processing

### 2. Automated Status Updates
```typescript
// Update status page automatically
export async function updateStatusPage(component: string, status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage') {
  const statusPageApi = 'https://api.statuspage.io/v1/pages/YOUR_PAGE_ID'
  
  await fetch(`${statusPageApi}/components/COMPONENT_ID`, {
    method: 'PATCH',
    headers: {
      'Authorization': `OAuth ${process.env.STATUSPAGE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      component: {
        status
      }
    })
  })
}
```

## Monitoring Dashboard

Create `src/app/admin/monitoring/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface SystemStatus {
  api: 'healthy' | 'degraded' | 'down'
  database: 'healthy' | 'degraded' | 'down' 
  payments: 'healthy' | 'degraded' | 'down'
  lastUpdate: string
}

export default function MonitoringDashboard() {
  const [status, setStatus] = useState<SystemStatus>()
  const [metrics, setMetrics] = useState({
    uptime: '99.99%',
    responseTime: '245ms',
    errorRate: '0.01%',
    activeUsers: 1247
  })

  useEffect(() => {
    const checkStatus = async () => {
      const response = await fetch('/api/health')
      const data = await response.json()
      
      setStatus({
        api: data.status === 'healthy' ? 'healthy' : 'down',
        database: data.services?.database === 'connected' ? 'healthy' : 'down',
        payments: data.services?.stripe === 'configured' ? 'healthy' : 'degraded',
        lastUpdate: new Date().toISOString()
      })
    }
    
    checkStatus()
    const interval = setInterval(checkStatus, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100'  
      case 'down': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">System Monitoring</h1>
      
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-2">API Status</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status?.api)}`}>
            {status?.api || 'Checking...'}
          </span>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-2">Database</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status?.database)}`}>
            {status?.database || 'Checking...'}
          </span>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-2">Payments</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status?.payments)}`}>
            {status?.payments || 'Checking...'}
          </span>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-2xl font-bold text-green-600">{metrics.uptime}</div>
          <div className="text-gray-600 text-sm">Uptime</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-2xl font-bold text-blue-600">{metrics.responseTime}</div>
          <div className="text-gray-600 text-sm">Avg Response</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-2xl font-bold text-red-600">{metrics.errorRate}</div>
          <div className="text-gray-600 text-sm">Error Rate</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow text-center">
          <div className="text-2xl font-bold text-purple-600">{metrics.activeUsers}</div>
          <div className="text-gray-600 text-sm">Active Users</div>
        </div>
      </div>
    </div>
  )
}
```

## Environment Variables
Add to `.env.local` and Vercel:

```env
# Monitoring & Analytics
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
STATUSPAGE_API_KEY=your-statuspage-api-key
VERCEL_ANALYTICS_ID=your-vercel-analytics-id

# Optional
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/xxx
```

This monitoring setup provides comprehensive coverage of your application's health, performance, and user experience, ensuring you can catch and resolve issues quickly during and after your launch.