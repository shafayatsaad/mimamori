const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function listRecursive() {
  console.log('Listing all files recursively in "documents" bucket...');
  const { data: files, error } = await supabase.storage
    .from('documents')
    .list('', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    console.error('Error listing root files:', error);
    return;
  }

  console.log('Root level items:', files.map(f => `${f.name} (${f.metadata ? 'FILE' : 'DIR'})`));

  for (const item of files) {
    if (!item.metadata) {
      // It's a directory
      const { data: subFiles, error: subError } = await supabase.storage
        .from('documents')
        .list(item.name, { limit: 100 });
      if (subError) {
        console.error(`Error listing folder ${item.name}:`, subError);
      } else {
        console.log(`Contents of "${item.name}":`, subFiles.map(f => f.name));
      }
    }
  }
}

listRecursive().catch(console.error);
