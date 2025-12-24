#!/usr/bin/env node
/**
 * CleverProfits Portal - Setup Verification Script
 * 
 * Run with: node scripts/verify-setup.mjs
 * 
 * Tests:
 * 1. Supabase connection
 * 2. Clerk configuration
 * 3. Anthropic API connection
 * 4. Database connection
 */

import { createClient } from '@supabase/supabase-js';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(type, message) {
  const icons = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
  };
  console.log(`${icons[type]} ${message}`);
}

async function testSupabase() {
  console.log('\n--- Testing Supabase ---');
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    log('error', 'Supabase URL or key not configured');
    return false;
  }
  
  try {
    const supabase = createClient(url, key);
    
    // Test connection by checking if we can access storage
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      log('error', `Supabase connection failed: ${error.message}`);
      return false;
    }
    
    log('success', `Supabase connected: ${url}`);
    
    // Check for storage bucket
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'cleverprofits-files';
    const bucket = data?.find(b => b.name === bucketName);
    
    if (bucket) {
      log('success', `Storage bucket found: ${bucketName}`);
    } else {
      log('warn', `Storage bucket '${bucketName}' not found. Create it in Supabase Dashboard → Storage`);
    }
    
    return true;
  } catch (error) {
    log('error', `Supabase test failed: ${error.message}`);
    return false;
  }
}

async function testClaude() {
  console.log('\n--- Testing Anthropic (Claude API) ---');
  
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    log('error', 'ANTHROPIC_API_KEY not configured');
    return false;
  }
  
  if (!apiKey.startsWith('sk-ant-')) {
    log('error', 'Invalid Anthropic API key format');
    return false;
  }
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [
          { role: 'user', content: 'Say "Connection successful" in exactly those words.' }
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      log('error', `Claude API error: ${error.error?.message || response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    
    if (text.toLowerCase().includes('connection successful')) {
      log('success', 'Claude API connected and responding');
      log('info', `Model: claude-sonnet-4-20250514`);
      return true;
    } else {
      log('warn', `Claude responded but with unexpected message: ${text.slice(0, 50)}...`);
      return true; // Still connected
    }
  } catch (error) {
    log('error', `Claude API test failed: ${error.message}`);
    return false;
  }
}

function testClerk() {
  console.log('\n--- Testing Clerk Configuration ---');
  
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  
  if (!publishableKey) {
    log('error', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not configured');
    return false;
  }
  
  if (!publishableKey.startsWith('pk_')) {
    log('error', 'Invalid Clerk publishable key format');
    return false;
  }
  
  log('success', `Clerk publishable key configured: ${publishableKey.slice(0, 20)}...`);
  
  if (!secretKey || secretKey === 'your_clerk_secret_key_here') {
    log('warn', 'CLERK_SECRET_KEY not configured - add it to .env.local');
    return false;
  }
  
  if (secretKey.startsWith('sk_')) {
    log('success', 'Clerk secret key configured');
    return true;
  }
  
  return false;
}

function testDatabase() {
  console.log('\n--- Testing Database Configuration ---');
  
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    log('error', 'DATABASE_URL not configured');
    return false;
  }
  
  if (dbUrl.includes('[YOUR-PASSWORD]')) {
    log('warn', 'DATABASE_URL contains placeholder - replace [YOUR-PASSWORD] with your Supabase database password');
    return false;
  }
  
  if (dbUrl.includes('supabase')) {
    log('success', 'DATABASE_URL configured for Supabase');
    return true;
  }
  
  log('info', 'DATABASE_URL configured');
  return true;
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   CleverProfits Portal - Setup Verification   ║');
  console.log('╚════════════════════════════════════════════╝');
  
  // Load environment
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  
  const results = {
    supabase: await testSupabase(),
    claude: await testClaude(),
    clerk: testClerk(),
    database: testDatabase(),
  };
  
  console.log('\n════════════════════════════════════════════');
  console.log('Summary:');
  console.log('════════════════════════════════════════════');
  
  let allPassed = true;
  for (const [service, passed] of Object.entries(results)) {
    const status = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`  ${service.padEnd(12)} ${status}`);
    if (!passed) allPassed = false;
  }
  
  console.log('════════════════════════════════════════════\n');
  
  if (allPassed) {
    log('success', 'All services configured correctly! You can run: npm run dev');
  } else {
    log('warn', 'Some services need configuration. See details above.');
    console.log('\nNext steps:');
    if (!results.clerk) {
      console.log('  1. Add CLERK_SECRET_KEY to .env.local');
    }
    if (!results.database) {
      console.log('  2. Update DATABASE_URL with your Supabase password');
      console.log('     Get it from: Supabase Dashboard → Settings → Database → Connection string');
    }
    if (!results.supabase) {
      console.log('  3. Create storage bucket "cleverprofits-files" in Supabase');
    }
  }
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
