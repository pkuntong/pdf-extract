#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Run this before deployment to ensure all required variables are set
 */

const requiredVars = {
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL': 'https://your-project-id.supabase.co',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'eyJhbGciOi...',
  'SUPABASE_SERVICE_ROLE_KEY': 'eyJhbGciOi...',
  
  // Stripe
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': 'pk_test_... or pk_live_...',
  'STRIPE_SECRET_KEY': 'sk_test_... or sk_live_...',
  'STRIPE_WEBHOOK_SECRET': 'whsec_...',
  'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID': 'price_...',
  
  // App
  'NEXT_PUBLIC_SITE_URL': 'https://your-domain.com'
};

const optionalVars = {
  'NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID': 'price_... (for business plan)',
  'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/... (for feedback notifications)'
};

console.log('🔍 Validating environment variables...\n');

let hasErrors = false;

// Check required variables
console.log('📋 Required Variables:');
Object.entries(requiredVars).forEach(([key, description]) => {
  const value = process.env[key];
  if (!value) {
    console.log(`❌ ${key}: Missing`);
    hasErrors = true;
  } else if (value.includes('your-') || value === description) {
    console.log(`⚠️  ${key}: Placeholder value detected`);
    hasErrors = true;
  } else {
    // Mask sensitive values
    const maskedValue = key.includes('SECRET') || key.includes('SERVICE_ROLE') 
      ? value.substring(0, 10) + '...' 
      : value.substring(0, 20) + (value.length > 20 ? '...' : '');
    console.log(`✅ ${key}: ${maskedValue}`);
  }
});

// Check optional variables
console.log('\n📋 Optional Variables:');
Object.entries(optionalVars).forEach(([key, description]) => {
  const value = process.env[key];
  if (value) {
    const maskedValue = key.includes('SECRET') 
      ? value.substring(0, 10) + '...' 
      : value.substring(0, 20) + (value.length > 20 ? '...' : '');
    console.log(`✅ ${key}: ${maskedValue}`);
  } else {
    console.log(`⚪ ${key}: Not set (${description})`);
  }
});

// Validate URL formats
console.log('\n🔗 URL Validation:');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  if (supabaseUrl.includes('supabase.co') && supabaseUrl.startsWith('https://')) {
    console.log('✅ Supabase URL format valid');
  } else {
    console.log('❌ Invalid Supabase URL format');
    hasErrors = true;
  }
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (siteUrl) {
  try {
    new URL(siteUrl);
    console.log('✅ Site URL format valid');
  } catch {
    console.log('❌ Invalid Site URL format');
    hasErrors = true;
  }
}

// Validate Stripe keys match environment
console.log('\n💳 Stripe Environment Check:');
const stripePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (stripePublic && stripeSecret) {
  const isPublicTest = stripePublic.startsWith('pk_test_');
  const isSecretTest = stripeSecret.startsWith('sk_test_');
  
  if (isPublicTest === isSecretTest) {
    console.log(`✅ Stripe keys match (${isPublicTest ? 'TEST' : 'LIVE'} mode)`);
  } else {
    console.log('❌ Stripe key mismatch (public/secret keys from different environments)');
    hasErrors = true;
  }
}

// Final result
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Environment validation FAILED');
  console.log('Please fix the issues above before deploying.');
  process.exit(1);
} else {
  console.log('✅ Environment validation PASSED');
  console.log('Ready for deployment!');
  process.exit(0);
}