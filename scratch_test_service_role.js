require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Instantiate client with service_role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function testServiceRole() {
  console.log('--- Testing Supabase DB operations with Service Role Key ---');
  
  const tempEmail = `test_${Date.now()}@example.com`;
  console.log(`Attempting to insert test user: ${tempEmail}`);

  const { data: insertedUser, error: insertError } = await supabase
    .from('users')
    .insert({
      email: tempEmail,
      name: 'Test Service Role User',
      password: 'hashedpassword',
      role: 'patient',
      createdAt: new Date().toISOString()
    })
    .select();

  if (insertError) {
    console.error('❌ Insert with service role key failed:', insertError);
  } else {
    console.log('✅ Insert with service role key succeeded:', insertedUser);
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', tempEmail);
      
    if (deleteError) {
      console.error('❌ Delete test user failed:', deleteError);
    } else {
      console.log('✅ Successfully cleaned up and deleted test user.');
    }
  }
}

testServiceRole().catch(console.error);
