require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Client } = require('pg');

async function checkPostgres() {
  console.log('--- Checking PostgreSQL connection... ---');
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    console.log('❌ POSTGRES_URL_NON_POOLING is not defined in env.');
    return;
  }
  console.log(`Connecting to: ${url.replace(/:[^:@]+@/, ':****@')}`);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('✅ PostgreSQL connection successful!');
    const res = await client.query('SELECT 1 AS result');
    console.log('✅ PostgreSQL test query successful! Result:', res.rows[0].result);
  } catch (error) {
    console.log('❌ PostgreSQL connection failed:', error.message);
  } finally {
    await client.end();
  }
}

async function checkGemini() {
  console.log('\n--- Checking Google Gemini connection... ---');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'mock-gemini-key') {
    console.log('❌ GEMINI_API_KEY is not defined or is still the placeholder "mock-gemini-key".');
    return;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent('Respond with "OK"');
    console.log(`✅ Google Gemini API call successful! Response: "${result.response.text().trim()}"`);
  } catch (error) {
    console.log('❌ Google Gemini API call failed:', error.message);
  }
}

async function checkSupabase() {
  console.log('\n--- Checking Supabase credentials... ---');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.log('❌ Supabase credentials not set in env.');
    return;
  }
  console.log(`Supabase URL: ${url}`);
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`
      }
    });
    if (response.ok) {
      console.log('✅ Supabase REST API connection successful!');
    } else {
      const text = await response.text();
      console.log(`❌ Supabase REST API returned status ${response.status}:`, text);
    }
  } catch (error) {
    console.log('❌ Supabase connection failed:', error.message);
  }
}

async function checkEnvVars() {
  console.log('\n--- Checking all environment variables... ---');
  const vars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'GEMINI_API_KEY',
    'JWT_SECRET',
    'NEXTAUTH_URL',
  ];
  for (const v of vars) {
    const val = process.env[v];
    if (!val) {
      console.log(`❌ ${v} — NOT SET`);
    } else {
      const display = v.includes('KEY') || v.includes('SECRET') || v.includes('POSTGRES')
        ? val.substring(0, 10) + '...'
        : val;
      console.log(`✅ ${v} = ${display}`);
    }
  }
}

async function main() {
  await checkEnvVars();
  await checkPostgres();
  await checkGemini();
  await checkSupabase();
}

main();

