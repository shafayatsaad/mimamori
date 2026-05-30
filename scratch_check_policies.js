require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const url = process.env.POSTGRES_URL_NON_POOLING;
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function listPolicies() {
  await client.connect();
  const res = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'users'
  `);
  console.log('--- RLS Policies on "users" table ---');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}

listPolicies().catch(console.error);
