import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { defineConfig } from "prisma/config";

const isCli = process.argv.some(arg => 
  arg.includes("prisma") || 
  arg.includes("db") || 
  arg.includes("migrate") ||
  arg.includes("generate")
);

const dbUrl = isCli 
  ? process.env.POSTGRES_URL_NON_POOLING 
  : (process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING);

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
  },
});
