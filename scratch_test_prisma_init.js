require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('./app/generated/prisma/client');

async function testInit() {
  console.log('Testing PrismaClient initialization...');
  const url = process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    console.error('Missing POSTGRES_URL_NON_POOLING');
    return;
  }
  
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: url
        }
      }
    });
    console.log('Client instantiated successfully. Connecting...');
    await prisma.$connect();
    console.log('✅ Connected successfully!');
    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Failed:', err);
  }
}

testInit();
