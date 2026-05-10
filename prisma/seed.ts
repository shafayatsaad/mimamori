import { PrismaClient } from '../app/generated/prisma/client';

const prisma = new PrismaClient();

const defaultPermissions = [
  { name: 'Diary', description: 'Access to patient diary entries' },
  { name: 'Alerts', description: 'Access to health alerts and notifications' },
  { name: 'Vault', description: 'Access to secure document vault' },
];

const defaultCategoryRules = [
  { mimePattern: 'image/tiff', extPattern: 'tiff,tif', documentType: 'Imaging', priority: 100 },
  { mimePattern: 'application/dicom', extPattern: 'dicom,dcm', documentType: 'Imaging', priority: 90 },
  { mimePattern: 'image', extPattern: null, documentType: 'Prescription', priority: 80 },
  { mimePattern: 'application/pdf', extPattern: 'pdf', documentType: 'Doctor Note', priority: 70 },
  { mimePattern: 'application/msword', extPattern: 'doc', documentType: 'Doctor Note', priority: 60 },
  { mimePattern: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extPattern: 'docx', documentType: 'Doctor Note', priority: 50 },
  { mimePattern: 'application/vnd.ms-excel', extPattern: 'xls', documentType: 'Lab Result', priority: 40 },
  { mimePattern: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extPattern: 'xlsx', documentType: 'Lab Result', priority: 30 },
];

async function main() {
  console.log('Seeding default permission types...');

  for (const perm of defaultPermissions) {
    await prisma.permissionType.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  const count = await prisma.permissionType.count();
  console.log(`Seeded ${count} permission types.`);

  console.log('Seeding default document category rules...');

  for (const rule of defaultCategoryRules) {
    const existing = await prisma.documentCategoryRule.findFirst({
      where: { mimePattern: rule.mimePattern, priority: rule.priority },
    });
    if (!existing) {
      await prisma.documentCategoryRule.create({ data: rule });
    }
  }

  const ruleCount = await prisma.documentCategoryRule.count();
  console.log(`Seeded ${ruleCount} document category rules.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
