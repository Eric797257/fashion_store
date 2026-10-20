import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

class Rollback extends Error { }
type Tx = Prisma.TransactionClient;

/** Creates a user, category, product and one variant for a test. */
async function fixtures(tx: Tx) {
    const s = Math.random().toString(36).slice(2, 8);
    const user = await tx.user.create({
        data: {
            id: `check-user-${s}`,
            name: "Check User",
            email: `check-${s}@example.test`,
            emailVerified: false,
        },
    });
    const category = await tx.category.create({ data: { name: "C", slug: `check-${s}` } });
    const product = await tx.product.create({
        data: {
            name: "P",
            slug: `check-p-${s}`,
            categoryId: category.id,
            price: "1000",
            variants: { create: [{ sku: `CHK-${s}`, size: "M", color: "Black", stockOnHand: 5 }] },
        },
        include: { variants: true },
    });
    const variant = product.variants[0];
    if (!variant) throw new Error("fixture variant missing");
    return { user, product, variant };
}

const addressData = (userId: string, isDefault: boolean) => ({
    userId,
    recipientName: "Test Person",
    phone: "+959000000000",
    region: "Yangon Region",
    township: "Bahan",
    addressLine: "1 Test Street",
    isDefault,
});

async function expectFailure(name: string, fn: (tx: Tx) => Promise<unknown>) {
    try {
        await prisma.$transaction(fn);
        console.error(`❌ ${name}: should have been rejected but was accepted`);
        process.exitCode = 1;
    } catch {
        console.log(`✅ ${name}: correctly rejected`);
    }
}

async function main() {
    // Happy path (also proves the fixtures are valid)
    try {
        await prisma.$transaction(async (tx) => {
            const { user, product, variant } = await fixtures(tx);
            await tx.address.create({ data: addressData(user.id, true) });
            await tx.address.create({ data: addressData(user.id, false) });
            await tx.cart.create({
                data: { userId: user.id, items: { create: [{ variantId: variant.id, quantity: 2 }] } },
            });
            await tx.cart.create({ data: { guestTokenHash: `hash-${user.id}` } });
            await tx.wishlist.create({
                data: { userId: user.id, items: { create: [{ productId: product.id }] } },
            });
            await tx.review.create({
                data: { productId: product.id, userId: user.id, rating: 5, body: "Great" },
            });
            console.log("✅ Valid addresses, carts, wishlist and review accepted (rolled back after)");
            throw new Rollback();
        });
    } catch (err) {
        if (!(err instanceof Rollback)) throw err;
    }

    await expectFailure("Second default address for one user", async (tx) => {
        const { user } = await fixtures(tx);
        await tx.address.create({ data: addressData(user.id, true) });
        await tx.address.create({ data: addressData(user.id, true) });
    });

    await expectFailure("Cart with no owner", async (tx) => {
        await tx.cart.create({ data: {} });
    });

    await expectFailure("Cart with both a user and a guest token", async (tx) => {
        const { user } = await fixtures(tx);
        await tx.cart.create({ data: { userId: user.id, guestTokenHash: "abc" } });
    });

    await expectFailure("Cart item with quantity 0", async (tx) => {
        const { user, variant } = await fixtures(tx);
        await tx.cart.create({
            data: { userId: user.id, items: { create: [{ variantId: variant.id, quantity: 0 }] } },
        });
    });

    await expectFailure("Same variant twice in one cart", async (tx) => {
        const { user, variant } = await fixtures(tx);
        await tx.cart.create({
            data: {
                userId: user.id,
                items: {
                    create: [
                        { variantId: variant.id, quantity: 1 },
                        { variantId: variant.id, quantity: 1 },
                    ],
                },
            },
        });
    });

    await expectFailure("Rating of 6", async (tx) => {
        const { user, product } = await fixtures(tx);
        await tx.review.create({ data: { productId: product.id, userId: user.id, rating: 6 } });
    });

    await expectFailure("Second review by the same user for one product", async (tx) => {
        const { user, product } = await fixtures(tx);
        await tx.review.create({ data: { productId: product.id, userId: user.id, rating: 4 } });
        await tx.review.create({ data: { productId: product.id, userId: user.id, rating: 5 } });
    });

    const leftovers = await prisma.user.count({ where: { email: { startsWith: "check-" } } });
    console.log(
        leftovers === 0 ? "✅ No test data left in the database" : `❌ ${leftovers} leftover users`,
    );
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());