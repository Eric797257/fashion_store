import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedRbac } from "./seeds/rbac";
import { seedSettings } from "./seeds/settings";
import { seedSample } from "./seeds/sample";
import { seedHomeSample } from "./seeds/home-sample";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Required reference data: safe and needed in every environment
  await seedRbac(prisma);
  await seedSettings(prisma);
  console.log("✅ Roles, permissions and store settings seeded");

  // Optional sample data: development only
  if (process.env.SEED_SAMPLE_DATA === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Refusing to seed sample data when NODE_ENV=production");
    }
    await seedSample(prisma);
    await seedHomeSample(prisma);
    console.log("✅ Sample fashion data seeded (all slugs/SKUs start with sample-/SAMPLE-)");
  } else {
    console.log("ℹ️  Sample data skipped (set SEED_SAMPLE_DATA=true to include it)");
  }
}

main()
  .catch((err) => {
    console.error("❌ Seed failed");
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());