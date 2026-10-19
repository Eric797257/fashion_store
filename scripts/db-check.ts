import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    console.log("✅ Database connected");
    console.log("   ", rows[0]?.version);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Database connection failed");
  console.error(err);
  if (err instanceof Error && err.cause) console.error("Cause:", err.cause);
  process.exit(1);
});