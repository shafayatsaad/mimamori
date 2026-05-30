require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  console.log('--- Testing Supabase Auth/DB operations with Anon Key ---');
  
  // 1. Try selecting from users table
  const { data: users, error: selectError } = await supabase
    .from('users')
    .select('*')
    .limit(1);
    
  if (selectError) {
    console.error('❌ Select from users table failed:', selectError);
  } else {
    console.log('✅ Select from users table succeeded. Rows found:', users.length);
  }

  // 2. Try inserting a temp user
  const tempEmail = `test_${Date.now()}@example.com`;
  const { data: insertedUser, error: insertError } = await supabase
    .from('users')
    .insert({
      email: tempEmail,
      name: 'Test User',
      password: 'hashedpassword',
      role: 'patient',
      createdAt: new Date().toISOString()
    })
    .select();

  if (insertError) {
    console.error('❌ Insert into users table failed:', insertError);
  } else {
    console.log('✅ Insert into users table succeeded:', insertedUser);
    // Delete the inserted user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', tempEmail);
    if (deleteError) {
      console.error('❌ Delete temp user failed:', deleteError);
    } else {
      console.log('✅ Deleted temp user.');
    }
  }
}

testSupabase();
