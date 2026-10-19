import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ROLE_KEYS,
} from "../../src/server/permissions/catalog";

export async function seedRbac(prisma: PrismaClient) {
  // 1) Permissions
  for (const def of PERMISSION_DEFINITIONS) {
    const [resource = "", action = ""] = def.key.split(".");
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { resource, action, description: def.description },
      create: { key: def.key, resource, action, description: def.description },
    });
  }

  const allPermissions = await prisma.permission.findMany({
    select: { id: true, key: true }, 
  });
  const idByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

  // 2) Roles + default grants
  for (const key of ROLE_KEYS) {
    const def = ROLE_DEFINITIONS[key];

    const role = await prisma.role.upsert({
      where: { key },
      update: { name: def.name, description: def.description, rank: def.rank, isSystem: true },
      create: {
        key,
        name: def.name,
        description: def.description,
        rank: def.rank,
        isSystem: true,
      },
    });

    const data = def.permissions.map((permissionKey) => {
      const permissionId = idByKey.get(permissionKey);
      if (!permissionId) throw new Error(`Permission not found: ${permissionKey}`);
      return { roleId: role.id, permissionId };
    });

    if (data.length > 0) {
      await prisma.rolePermission.createMany({ data, skipDuplicates: true });
    }
  }
}