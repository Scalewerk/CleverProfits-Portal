#!/usr/bin/env node

/**
 * Seed Script for CleverProfits Portal
 *
 * Creates a test company and links the first Clerk user as admin.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed script...\n');

  // Step 1: Check for existing test company
  let company = await prisma.company.findFirst({
    where: { name: 'Test Company' },
  });

  if (company) {
    console.log('✅ Test Company already exists:', company.id);
  } else {
    // Create Test Company with default metric config
    company = await prisma.company.create({
      data: {
        name: 'Test Company',
        metricConfig: {
          create: {
            preset: 'standard',
            includeExecutiveSnapshot: true,
            includeRevenuePerformance: true,
            includeCogsGrossMargin: true,
            includeOperatingExpenses: true,
            includeProfitabilityBridges: false,
            includeVariancePerformance: false,
            includeCashFlowLiquidity: false,
            includeBalanceSheetHealth: false,
            includeRiskControls: false,
          },
        },
      },
    });
    console.log('✅ Created Test Company:', company.id);
  }

  // Step 2: Get Clerk user from API
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

  if (!CLERK_SECRET_KEY) {
    console.error('❌ CLERK_SECRET_KEY not found in environment');
    process.exit(1);
  }

  console.log('\n📡 Fetching users from Clerk API...');

  const response = await fetch('https://api.clerk.com/v1/users?limit=10', {
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Failed to fetch Clerk users:', error);
    process.exit(1);
  }

  const clerkUsers = await response.json();

  if (!clerkUsers || clerkUsers.length === 0) {
    console.log('⚠️  No Clerk users found. Please sign up first at http://localhost:3000/sign-up');
    console.log('   Then run this script again.');
    process.exit(0);
  }

  console.log(`   Found ${clerkUsers.length} Clerk user(s)`);

  // Step 3: Create/update user records in our database
  for (const clerkUser of clerkUsers) {
    const clerkUserId = clerkUser.id;
    const primaryEmail = clerkUser.email_addresses?.find(
      e => e.id === clerkUser.primary_email_address_id
    );

    if (!primaryEmail) {
      console.log(`   ⚠️  Skipping user ${clerkUserId} - no primary email`);
      continue;
    }

    const email = primaryEmail.email_address;

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (user) {
      // Update to link to Test Company if not already linked
      if (user.companyId !== company.id) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            companyId: company.id,
            role: 'admin',
          },
        });
        console.log(`✅ Updated user ${email} → linked to Test Company as admin`);
      } else {
        console.log(`✅ User ${email} already linked to Test Company`);
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          clerkUserId,
          email,
          role: 'admin',
          companyId: company.id,
        },
      });
      console.log(`✅ Created user ${email} as admin for Test Company`);
    }
  }

  // Step 4: Show summary
  const userCount = await prisma.user.count({ where: { companyId: company.id } });
  const reportCount = await prisma.report.count({ where: { companyId: company.id } });

  console.log('\n📊 Summary:');
  console.log(`   Company: ${company.name} (${company.id})`);
  console.log(`   Users: ${userCount}`);
  console.log(`   Reports: ${reportCount}`);
  console.log('\n🎉 Seed complete! You can now access the dashboard at http://localhost:3000/dashboard');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
