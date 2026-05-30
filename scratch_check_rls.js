require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const url = process.env.POSTGRES_URL_NON_POOLING;
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function checkRLS() {
  await client.connect();
  const res = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
  `);
  console.log('--- RLS Status on public tables ---');
  console.log(res.rows);
  await client.end();
}

checkRLS().catch(console.error);
