/**
 * Verify that all required Supabase tables exist and have the correct columns.
 * Run: node supabase/verify-tables.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cpjikhoftqguphrwrcel.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || 'sb_publishable_DmKt29bhkGpyw_JvIw2J3w_BFpZ3CY9';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXPECTED_TABLES = {
  users:          ['email', 'name', 'password', 'role', 'createdAt'],
  user_state:     ['email', 'profile', 'caregivers', 'invitations', 'appointments', 'custom_notes', 'updated_at'],
  journals:       ['id', 'email', 'date', 'data', 'created_at'],
  hydration_logs: ['id', 'email', 'date', 'data', 'created_at'],
  documents:      ['id', 'email', 'type', 'data', 'created_at'],
  alerts:         ['id', 'email', 'type', 'title', 'message', 'read', 'source_doc_id', 'created_at'],
  reset_tokens:   ['token', 'email', 'used', 'created_at', 'expires_at'],
};

let passed = 0;
let failed = 0;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Mimamori — Supabase Table Verification');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  URL: ${SUPABASE_URL}`);
console.log('');

for (const [table, expectedCols] of Object.entries(EXPECTED_TABLES)) {
  // Try a lightweight select to check if the table exists and see what columns come back.
  const { data, error } = await supabase.from(table).select('*').limit(0);

  if (error) {
    console.log(`  ❌  ${table.padEnd(16)} — ERROR: ${error.message}`);
    failed++;
    continue;
  }

  // Supabase returns an empty array when the table is empty, which is fine.
  // To introspect columns we do a .select('*').limit(1) and check the keys,
  // but with 0 rows we can't see keys that way. Instead, insert+rollback isn't
  // possible from the client. We'll do a simpler probe: select each expected column.
  const missingCols = [];
  for (const col of expectedCols) {
    const probe = await supabase.from(table).select(col).limit(0);
    if (probe.error) {
      missingCols.push(col);
    }
  }

  if (missingCols.length > 0) {
    console.log(`  ⚠️  ${table.padEnd(16)} — EXISTS but missing columns: ${missingCols.join(', ')}`);
    failed++;
  } else {
    console.log(`  ✅  ${table.padEnd(16)} — OK  (${expectedCols.length} columns verified)`);
    passed++;
  }
}

// Check storage bucket
console.log('');
console.log('  Storage Buckets:');
const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
if (bucketsErr) {
  console.log(`  ❌  documents bucket — ERROR: ${bucketsErr.message}`);
  failed++;
} else {
  const docBucket = (buckets || []).find(b => b.id === 'documents');
  if (docBucket) {
    console.log(`  ✅  documents bucket  — OK  (public: ${docBucket.public})`);
    passed++;
  } else {
    console.log(`  ❌  documents bucket  — NOT FOUND`);
    failed++;
  }
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Result: ${passed} passed, ${failed} failed out of ${passed + failed} checks`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

process.exit(failed > 0 ? 1 : 0);
