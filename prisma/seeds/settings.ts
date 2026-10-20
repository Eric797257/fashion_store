import type { PrismaClient } from "../../src/generated/prisma/client";

export async function seedSettings(prisma: PrismaClient) {
    // update: {} means we never overwrite what the owner edited in the admin
    await prisma.storeSettings.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default", manualTransferAccounts: [] },
    });
}