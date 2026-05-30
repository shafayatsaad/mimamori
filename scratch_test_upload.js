require('dotenv').config({ path: '.env.local' });
const { supabase } = require('./lib/supabase-client');

async function testUpload() {
  console.log('Testing Supabase Client upload...');
  const key = `public/test-${Date.now()}.txt`;
  const buffer = Buffer.from('Hello Mimamori!');
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(key, buffer, {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('Upload succeeded:', data);
    
    // Clean up
    console.log('Cleaning up uploaded file...');
    const { data: delData, error: delError } = await supabase.storage
      .from('documents')
      .remove([key]);
    if (delError) console.error('Cleanup failed:', delError);
    else console.log('Cleanup succeeded:', delData);
  }
}

testUpload().catch(console.error);
