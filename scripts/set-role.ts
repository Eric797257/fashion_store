import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ROLE_KEYS, type RoleKey } from "../src/server/permissions/catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [emailArg, roleArg] = process.argv.slice(2);

  if (!emailArg || !roleArg || !ROLE_KEYS.includes(roleArg as RoleKey)) {
    console.error(`Usage: npm run user:set-role -- <email> <${ROLE_KEYS.join("|")}>`);
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ No account found for ${email}. Sign up first.`);
    process.exit(1);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: roleArg } }),
    prisma.auditLog.create({
      data: {
        actorRole: "CLI",
        action: "user.set_role",
        entityType: "User",
        entityId: user.id,
        summary: `Role changed via command line`,
        before: { role: user.role },
        after: { role: roleArg },
      },
    }),
  ]);

  console.log(`✅ ${email}: ${user.role ?? "none"} → ${roleArg}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());