import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

class Rollback extends Error {}

async function expectFailure(name: string, fn: () => Promise<unknown>) {
    try {
        await fn();
        console.error(`❌ ${name}: should have been rejected but was accepted`);
        process.exitCode = 1;
    } catch {
        console.log(`✅ ${name}: correctly rejected`);
    }
}

async function main() {
    // 1) Happy path: create a category, product and variant, then roll everything back
    try {
        await prisma.$transaction(async (tx) => {
            const category = await tx.category.create({
                data: { name: "Check Category", slug: "check-category" },
            });
            const product = await tx.product.create({
                data: {
                    name: "Check Shirt",
                    slug: "check-shirt",
                    categoryId: category.id,
                    price: "45000",
                    salePrice: "38000",
                    variants: {
                        create: [{ sku: "CHECK-M-BLACK", size: "M", color: "Black", stockOnHand: 5 }],
                    },
                },
                include: { variants: true },
            });
            console.log(`✅ Created product with ${product.variants.length} variant (rolled back after)`);
            throw new Rollback();
        });
    } catch (err) {
        if (!(err instanceof Rollback)) throw err;
    }

    // 2) The database must reject bad data
    await expectFailure("Sale price higher than price", () =>   
        prisma.$transaction(async (tx) => {
            const c = await tx.category.create({ data: { name: "X", slug: "check-x" } });
            await tx.product.create({
                data: { name: "Bad", slug: "check-bad", categoryId: c.id, price: "1000", salePrice: "2000" },
            });
        }),
    );

    await expectFailure("Reserved stock greater than stock on hand", () => 
        prisma.$transaction(async (tx) => {
            const c = await tx.category.create({ data: { name: "Y", slug: "check-y" } });
            await tx.product.create({
                data: {
                    name: "Bad stock",
                    slug: "check-bad-stock",
                    categoryId: c.id,
                    price: "1000",
                    variants: {
                        create: [{ sku: "CHECK-BAD", size: "M", color: "Black", stockOnHand: 5, stockReserved: 6 }],
                    },
                },
            });
        }),
    );

    await expectFailure("Negative stock", () =>
        prisma.$transaction(async (tx) => {
            const c = await tx.category.create({ data: { name: "Z", slug: "check-z" } });
            await tx.product.create({
                data: {
                    name: "Negative",
                    slug: "check-negative",
                    categoryId: c.id,
                    price: "1000",
                    variants: { create: [{ sku: "CHECK-NEG", size: "M", color: "Black", stockOnHand: -1 }] },
                },
            });
        }),
    );

    // 3) Confirm nothing was left behind
    const leftovers = await prisma.category.count({ where: { slug: { startsWith: "check-" } } });
    console.log(leftovers === 0 ? "✅ No test data left in the database" : `❌ ${leftovers} leftover rows`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());