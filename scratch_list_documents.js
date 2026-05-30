require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function listDocs() {
  const { data: docs, error } = await supabase.from('documents').select('*');
  if (error) {
    console.error('Error fetching documents:', error);
    return;
  }
  console.log('--- Uploaded Documents ---');
  console.log(JSON.stringify(docs, null, 2));
}

listDocs().catch(console.error);
