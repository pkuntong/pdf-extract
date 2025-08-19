#!/usr/bin/env node

/**
 * Production Testing Script
 * Tests key functionality after deployment
 */

const https = require('https');
const http = require('http');

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.vercel.app';

console.log('🧪 Testing Production Deployment');
console.log(`🌐 Site URL: ${SITE_URL}\n`);

// Test cases
const tests = [
  {
    name: 'Homepage loads',
    path: '/',
    expected: 200
  },
  {
    name: 'Auth page loads',
    path: '/auth',
    expected: 200
  },
  {
    name: 'Pricing page loads',
    path: '/pricing',
    expected: 200
  },
  {
    name: 'Feedback API responds',
    path: '/api/feedback',
    method: 'POST',
    body: JSON.stringify({
      rating: 5,
      feedback: 'Test feedback from deployment script',
      page: '/test'
    }),
    headers: {
      'Content-Type': 'application/json'
    },
    expected: 200
  },
  {
    name: 'Extract API responds (should require auth)',
    path: '/api/extract-simple',
    method: 'POST',
    expected: [400, 401] // Should fail without proper request
  }
];

// Test function
async function runTest(test) {
  return new Promise((resolve) => {
    const url = new URL(test.path, SITE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: test.method || 'GET',
      headers: test.headers || {}
    };

    if (test.body) {
      options.headers['Content-Length'] = Buffer.byteLength(test.body);
    }

    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      const expectedCodes = Array.isArray(test.expected) ? test.expected : [test.expected];
      const success = expectedCodes.includes(res.statusCode);
      
      resolve({
        name: test.name,
        success,
        statusCode: res.statusCode,
        expected: test.expected
      });
    });

    req.on('error', (error) => {
      resolve({
        name: test.name,
        success: false,
        error: error.message
      });
    });

    if (test.body) {
      req.write(test.body);
    }
    
    req.end();
  });
}

// Run all tests
async function runAllTests() {
  console.log('Running tests...\n');
  
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await runTest(test);
    
    if (result.success) {
      console.log(`✅ ${result.name} (${result.statusCode})`);
      passed++;
    } else {
      console.log(`❌ ${result.name} ${result.error ? `(${result.error})` : `(got ${result.statusCode}, expected ${result.expected})`}`);
      failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Deployment looks good.');
  } else {
    console.log('⚠️  Some tests failed. Please investigate.');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Check if site URL is set
if (SITE_URL.includes('your-domain')) {
  console.log('❌ Please set NEXT_PUBLIC_SITE_URL to your actual domain');
  process.exit(1);
}

runAllTests().catch(error => {
  console.error('💥 Test runner error:', error);
  process.exit(1);
});