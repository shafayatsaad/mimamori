require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PrismaClient } = require('./app/generated/prisma/client');

async function checkPostgres() {
  console.log('--- Checking PostgreSQL connection... ---');
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    console.log('❌ POSTGRES_URL_NON_POOLING is not defined in env.');
    return;
  }
  console.log(`Connecting to: ${url.replace(/:[^:@]+@/, ':****@')}`);
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connection successful!');
    // Let's do a simple query
    await prisma.$executeRaw`SELECT 1`;
    console.log('✅ PostgreSQL test query successful!');
  } catch (error) {
    console.log('❌ PostgreSQL connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
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

async function main() {
  await checkPostgres();
  await checkGemini();
  await checkSupabase();
}

main();
