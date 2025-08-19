# PDF Extract Pro - Deployment Guide

## Prerequisites

- [Vercel Account](https://vercel.com)
- [Supabase Account](https://supabase.com)
- [Stripe Account](https://stripe.com)
- GitHub repository (recommended)

## Step 1: Supabase Setup

### 1.1 Create New Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose organization and enter project details:
   - **Name**: pdf-extract-pro
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for project initialization (2-3 minutes)

### 1.2 Get Supabase Credentials

From your project dashboard, go to Settings → API:
- **Project URL**: `https://your-project-id.supabase.co`
- **anon public key**: `eyJhbGciOi...`
- **service_role key**: `eyJhbGciOi...` (keep secret!)

## Step 2: Database Setup

### 2.1 Run Database Migrations

Go to SQL Editor in Supabase dashboard and run these commands:

#### Enable Row Level Security and Create Tables

```sql
-- Enable RLS on auth schema tables if not already enabled
-- (Usually enabled by default)

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id VARCHAR(255) UNIQUE NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  price_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback table
CREATE TABLE public.feedback (
  id SERIAL PRIMARY KEY,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NOT NULL,
  email VARCHAR(255),
  page VARCHAR(255),
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Create policy for feedback (allow anonymous inserts)
CREATE POLICY "Allow anonymous feedback" ON public.feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can read feedback" ON public.feedback
  FOR SELECT USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at);

-- Create updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 2.2 Configure Auth Settings

1. Go to Authentication → Settings
2. **Site URL**: Add your domain (initially `http://localhost:3000`)
3. **Redirect URLs**: Add:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.vercel.app/auth/callback` (add after deployment)

## Step 3: Stripe Setup

### 3.1 Create Products and Prices

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to Test mode initially
3. Go to Products → Create product:

#### Pro Plan
- **Name**: PDF Extract Pro
- **Pricing**: $9.99/month recurring
- **Copy the Price ID** (starts with `price_`)

#### Business Plan (Optional)
- **Name**: PDF Extract Business  
- **Pricing**: $29.99/month recurring
- **Copy the Price ID**

### 3.2 Get Stripe Keys

From Developers → API keys:
- **Publishable key**: `pk_test_...` (safe to expose)
- **Secret key**: `sk_test_...` (keep secret!)

### 3.3 Set up Webhook Endpoint

1. Go to Developers → Webhooks → Add endpoint
2. **Endpoint URL**: `https://your-domain.vercel.app/api/webhooks/stripe` (add after deployment)
3. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. **Copy webhook signing secret** (starts with `whsec_`)

## Step 4: Environment Variables

Create/update your `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID=price_...

# Optional: Slack notifications for feedback
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Production URLs (update after deployment)
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

## Step 5: Vercel Deployment

### 5.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your Git repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `npm run build`
   - **Output Directory**: Leave empty (auto-detected)

### 5.2 Add Environment Variables

In Vercel dashboard → Settings → Environment Variables, add all variables from `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL = https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOi...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_...
STRIPE_SECRET_KEY = sk_test_...
STRIPE_WEBHOOK_SECRET = whsec_...
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = price_...
NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID = price_...
NEXT_PUBLIC_SITE_URL = https://your-domain.vercel.app
```

**Important**: Mark sensitive keys (service role, stripe secret) as "Sensitive"

### 5.3 Deploy

1. Click "Deploy"
2. Wait for build to complete (2-5 minutes)
3. Your app will be available at `https://your-project-name.vercel.app`

## Step 6: Post-Deployment Configuration

### 6.1 Update Supabase Auth URLs

1. Go back to Supabase → Authentication → Settings
2. Update **Site URL** to your Vercel domain
3. Add redirect URL: `https://your-domain.vercel.app/auth/callback`

### 6.2 Update Stripe Webhook

1. Go to Stripe → Developers → Webhooks
2. Update endpoint URL to: `https://your-domain.vercel.app/api/webhooks/stripe`
3. Test webhook by clicking "Send test webhook"

### 6.3 Update Environment Variables

1. In Vercel → Settings → Environment Variables
2. Update `NEXT_PUBLIC_SITE_URL` to your actual domain
3. Redeploy to apply changes

## Step 7: Testing Production

### 7.1 Test Authentication
- [ ] Sign up with email
- [ ] Confirm email 
- [ ] Log in/out
- [ ] Password reset

### 7.2 Test Core Features
- [ ] Upload PDFs (free tier limits)
- [ ] OCR processing
- [ ] Data extraction
- [ ] CSV export

### 7.3 Test Payments
- [ ] Upgrade flow
- [ ] Stripe checkout (use test card: `4242 4242 4242 4242`)
- [ ] Webhook processing
- [ ] Premium features activation
- [ ] Dashboard access

### 7.4 Test Feedback
- [ ] Feedback widget appears
- [ ] Form submission works
- [ ] Data appears in Supabase

## Step 8: Go Live (Production)

### 8.1 Switch to Production Stripe

1. In Stripe dashboard, toggle to "Live mode"
2. Create same products/prices in live mode
3. Get live API keys
4. Update environment variables in Vercel
5. Update webhook endpoint URL

### 8.2 Domain Setup (Optional)

1. Purchase custom domain
2. In Vercel → Settings → Domains
3. Add your custom domain
4. Update all URLs in Supabase and Stripe

## Troubleshooting

### Common Issues

#### Build Errors
- **Module not found**: Check imports and dependencies
- **Environment variables**: Ensure all required vars are set
- **TypeScript errors**: Run `npm run type-check` locally

#### Runtime Errors
- **CORS issues**: Check Supabase RLS policies
- **Webhook failures**: Verify webhook URL and secret
- **Auth redirects**: Check redirect URLs in Supabase

#### Performance
- **Slow API responses**: Check database indexes
- **Large bundle size**: Analyze with `npm run analyze`
- **Image optimization**: Use Next.js Image component

### Monitoring

- **Vercel Analytics**: Enable in project settings
- **Supabase Metrics**: Monitor database performance
- **Stripe Logs**: Check payment processing
- **Error Tracking**: Consider Sentry integration

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key secured (not in client code)
- [ ] Webhook signatures verified
- [ ] HTTPS enforced
- [ ] Input validation on all forms
- [ ] File upload restrictions enforced

## Next Steps

1. Set up monitoring and alerting
2. Configure analytics (Google Analytics, PostHog)
3. Set up error tracking (Sentry)
4. Implement automated backups
5. Add more payment methods
6. Set up staging environment
7. Configure CI/CD pipeline

---

**Need Help?**
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)