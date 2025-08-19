#!/bin/bash

# Deployment script for PDF Extract Pro
set -e

echo "🚀 PDF Extract Pro Deployment Script"
echo "====================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Load environment variables if .env.local exists
if [ -f ".env.local" ]; then
    echo "📋 Loading local environment variables..."
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Run pre-deployment checks
echo "🔍 Running pre-deployment checks..."
npm run deploy-check

if [ $? -ne 0 ]; then
    echo "❌ Pre-deployment checks failed. Please fix issues before deploying."
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."

# Check if this is production deployment
if [ "$1" = "--prod" ] || [ "$1" = "-p" ]; then
    echo "🌟 Deploying to PRODUCTION..."
    vercel --prod
else
    echo "🔧 Deploying to PREVIEW..."
    vercel
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test your deployment URL"
echo "2. Update Supabase auth redirect URLs"
echo "3. Update Stripe webhook endpoint"
echo "4. Run end-to-end tests"
echo ""
echo "🔗 Useful links:"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo "- Supabase Dashboard: https://app.supabase.com"
echo "- Stripe Dashboard: https://dashboard.stripe.com"