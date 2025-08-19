# 🚀 Deployment Checklist

## Pre-Deployment (Local Setup)

### ☐ **Supabase Setup**
- [ ] Create new Supabase project
- [ ] Copy Project URL and API keys
- [ ] Run database migrations (`supabase/migrations/001_initial_schema.sql`)
- [ ] Set up Row Level Security policies
- [ ] Configure Auth settings (Site URL, Redirect URLs)

### ☐ **Stripe Setup**  
- [ ] Create products and prices (Pro: $9.99/month)
- [ ] Copy Price IDs
- [ ] Get Publishable and Secret keys
- [ ] Create webhook endpoint (will update URL later)

### ☐ **Environment Variables**
- [ ] Create `.env.local` with all required variables
- [ ] Run `npm run validate-env` to check configuration
- [ ] Ensure no placeholder values remain

## Deployment

### ☐ **Code Preparation**
- [ ] Run `npm run deploy-check` (type-check + lint + env validation)
- [ ] Fix any TypeScript or linting errors
- [ ] Commit and push all changes to Git

### ☐ **Vercel Deployment**
- [ ] Connect GitHub repository to Vercel
- [ ] Add environment variables in Vercel dashboard
- [ ] Mark sensitive keys as "Sensitive"
- [ ] Deploy and wait for build completion

## Post-Deployment

### ☐ **Update External Services**
- [ ] Update Supabase Site URL to Vercel domain
- [ ] Add Vercel domain to Supabase redirect URLs
- [ ] Update Stripe webhook endpoint URL
- [ ] Update `NEXT_PUBLIC_SITE_URL` environment variable

### ☐ **Testing**
- [ ] Run `npm run test-production` script
- [ ] Test user authentication (sign up, login, logout)
- [ ] Test PDF upload and processing
- [ ] Test payment flow with Stripe test cards
- [ ] Test feedback widget submission
- [ ] Verify webhook processing

### ☐ **Monitoring Setup**
- [ ] Enable Vercel Analytics
- [ ] Monitor Supabase database metrics
- [ ] Check Stripe webhook logs
- [ ] Set up error alerts (optional)

## Go Live (Production)

### ☐ **Production Stripe**
- [ ] Switch to Live mode in Stripe
- [ ] Create products/prices in live mode
- [ ] Update environment variables with live keys
- [ ] Update webhook endpoint to live mode

### ☐ **Domain Setup (Optional)**
- [ ] Purchase custom domain
- [ ] Add domain to Vercel
- [ ] Update all service URLs
- [ ] Set up SSL certificate

## Quick Commands

```bash
# Validate environment
npm run validate-env

# Run all checks before deployment
npm run deploy-check

# Deploy to Vercel preview
./scripts/deploy.sh

# Deploy to production
./scripts/deploy.sh --prod

# Test production deployment
npm run test-production
```

## Test Cards (Stripe)

**Success**: `4242 4242 4242 4242`  
**Decline**: `4000 0000 0000 0002`  
**3D Secure**: `4000 0000 0000 3220`

Use any future expiry date and any 3-digit CVC.

## Important URLs

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **Stripe Dashboard**: https://dashboard.stripe.com

## Common Issues & Solutions

### Build Errors
- **"Module not found"**: Check imports and dependency installation
- **TypeScript errors**: Run `npm run type-check` locally
- **Environment variables**: Verify all required vars are set

### Runtime Errors  
- **Auth redirect loops**: Check Supabase redirect URLs
- **Payment failures**: Verify Stripe keys match environment
- **Database errors**: Check RLS policies and table permissions

### Performance Issues
- **Slow API responses**: Add database indexes
- **Large bundle size**: Use dynamic imports for heavy libraries
- **Memory issues**: Check Vercel function limits (1GB)

---

**🎉 Ready to deploy? Follow the checklist step by step!**