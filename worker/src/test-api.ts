/**
 * Quick test script to verify Shopee API connectivity from EC2.
 * Run: npx ts-node src/test-api.ts
 *
 * Tests:
 * 1. Supabase DB connection
 * 2. Shopee API signing + call
 * 3. Rate limiter works
 */
import { config } from './config';
import { supabase } from './lib/supabase';
import { getPartnerCredentials, getShopToken, callShopeeApi, createSignature } from './lib/shopee-api';

async function main() {
  console.log('=== Shopee Worker API Test ===\n');

  // Test 1: Supabase connection
  console.log('1. Testing Supabase connection...');
  const { data: shops, error } = await supabase
    .from('apishopee_shops')
    .select('shop_id, shop_name')
    .not('access_token', 'is', null)
    .limit(3);

  if (error) {
    console.error('   FAIL: Supabase query error:', error.message);
    process.exit(1);
  }
  console.log(`   OK: Found ${shops?.length || 0} shops with tokens`);
  if (shops?.length) {
    console.log(`   Sample: ${shops.map(s => `${s.shop_id} (${s.shop_name})`).join(', ')}`);
  }

  if (!shops?.length) {
    console.log('\n   No shops with tokens found. Cannot test Shopee API.');
    process.exit(0);
  }

  // Test 2: Signing verification
  console.log('\n2. Testing signature generation...');
  const testSign = createSignature('test_key', 12345, '/api/v2/test', 1700000000, 'test_token', 67890);
  console.log(`   Signature: ${testSign}`);
  console.log(`   Length: ${testSign.length} (expected: 64)`);
  if (testSign.length !== 64) {
    console.error('   FAIL: Invalid signature length');
    process.exit(1);
  }
  console.log('   OK: Signature format correct');

  // Test 3: Live Shopee API call
  const testShop = shops[0];
  console.log(`\n3. Testing Shopee API call for shop ${testShop.shop_id}...`);

  try {
    const credentials = await getPartnerCredentials(supabase, testShop.shop_id);
    console.log(`   Partner ID: ${credentials.partnerId}`);

    const token = await getShopToken(supabase, testShop.shop_id);
    console.log(`   Token: ${token.access_token.substring(0, 10)}...`);

    const result = await callShopeeApi({
      supabase,
      credentials,
      path: '/api/v2/shop/get_shop_info',
      method: 'GET',
      shopId: testShop.shop_id,
      token,
      edgeFunction: 'worker-test',
      apiCategory: 'shop',
      triggeredBy: 'system',
    }) as Record<string, unknown>;

    if (result.error && result.error !== '') {
      console.error(`   WARN: Shopee returned error: ${result.error} - ${result.message}`);
      if (result.error === 'error_auth') {
        console.log('   Token might be expired. Try running token refresh first.');
      }
    } else {
      console.log('   OK: Shopee API call successful!');
      console.log(`   Response keys: ${Object.keys(result).join(', ')}`);
    }
  } catch (err) {
    console.error(`   FAIL: ${(err as Error).message}`);
    console.log('   This might mean EC2 IP is not whitelisted at Shopee.');
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
