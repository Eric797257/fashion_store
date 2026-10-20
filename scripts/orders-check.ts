import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

class Rollback extends Error { }
type Tx = Prisma.TransactionClient;

const rand = () => Math.random().toString(36).slice(2, 8);

async function fixtures(tx: Tx) {
    const s = rand();
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
            price: "45000",
            variants: { create: [{ sku: `CHK-${s}`, size: "M", color: "Black", stockOnHand: 10 }] },
        },
        include: { variants: true },
    });
    const variant = product.variants[0];
    if (!variant) throw new Error("fixture variant missing");
    return { s, user, variant };
}

function orderData(
    s: string,
    userId: string | null,
    over: Partial<Prisma.OrderUncheckedCreateInput> = {},
): Prisma.OrderUncheckedCreateInput {
    return {
        orderNumber: `CHK-${s}`,
        idempotencyKey: `idem-${s}`,
        userId,
        paymentMethod: "MANUAL_TRANSFER",
        customerName: "Test Person",
        customerPhone: "+959000000000",
        shipRecipientName: "Test Person",
        shipPhone: "+959000000000",
        shipRegion: "Yangon Region",
        shipTownship: "Bahan",
        shipAddressLine: "1 Test Street",
        shippingMethodCode: "in-house-standard",
        shippingMethodName: "Standard delivery",
        subtotal: "90000",
        discountTotal: "5000",
        shippingFee: "3000",
        taxTotal: "0",
        total: "88000",
        ...over,
    };
}

function itemData(
    variantId: string,
    over: Partial<Prisma.OrderItemUncheckedCreateWithoutOrderInput> = {},
): Prisma.OrderItemUncheckedCreateWithoutOrderInput {
    return {
        variantId,
        productName: "Check Shirt",
        sku: "CHK-SKU",
        size: "M",
        color: "Black",
        unitPrice: "45000",
        quantity: 2,
        discountAmount: "5000",
        taxAmount: "0",
        lineTotal: "85000",
        ...over,
    };
}

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
    // ---- Happy path: a complete order with payment, slip, refund, coupon, reservation ----
    try {
        await prisma.$transaction(async (tx) => {
            const { s, user, variant } = await fixtures(tx);

            const coupon = await tx.coupon.create({
                data: {
                    code: `CHECK${s.toUpperCase()}`,
                    discountType: "FIXED_AMOUNT",
                    value: "5000",
                    usageLimit: 10,
                    usedCount: 1,
                },
            });

            const order = await tx.order.create({
                data: {
                    ...orderData(s, user.id, { couponCode: coupon.code }),
                    items: { create: [itemData(variant.id)] },
                    events: { create: [{ type: "ORDER_PLACED", actorType: "CUSTOMER", actorId: user.id }] },
                },
            });

            const payment = await tx.payment.create({
                data: {
                    orderId: order.id,
                    method: "MANUAL_TRANSFER",
                    provider: "manual-transfer",
                    status: "PENDING_VERIFICATION",
                    amount: "88000",
                    providerReference: `ref-${s}`,
                },
            });

            await tx.paymentSlip.create({
                data: { paymentId: payment.id, channel: "KBZPAY", imageUrl: "/uploads/test-slip.jpg" },
            });
            await tx.refund.create({ data: { paymentId: payment.id, amount: "1000", reason: "test" } });
            await tx.couponRedemption.create({
                data: {
                    couponId: coupon.id,
                    orderId: order.id,
                    userId: user.id,
                    customerPhone: "+959000000000",
                    discountAmount: "5000",
                },
            });
            await tx.inventoryReservation.create({
                data: {
                    checkoutSessionId: `sess-${s}`,
                    variantId: variant.id,
                    orderId: order.id,
                    quantity: 2,
                    status: "COMMITTED",
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });
            await tx.processedWebhookEvent.create({
                data: { source: "payment:dev-gateway", eventId: `evt-${s}` },
            });

            console.log("✅ Complete order with payment, slip, refund, coupon and reservation accepted (rolled back after)");
            throw new Rollback();
        });
    } catch (err) {
        if (!(err instanceof Rollback)) throw err;
    }

    // ---- Orders ----
    await expectFailure("Order total that does not add up", async (tx) => {
        const { s } = await fixtures(tx);
        await tx.order.create({ data: orderData(s, null, { total: "1" }) });
    });

    await expectFailure("Refunded amount grater than the order total", async (tx) => {
        const { s } = await fixtures(tx);
        await tx.order.create({ data: orderData(s, null, { refundedTotal: "999999" }) });
    });

    await expectFailure("Duplicate idempotency key (double submit)", async (tx) => {
        const { s } = await fixtures(tx);
        await tx.order.create({ data: orderData(s, null) });
        await tx.order.create({
            data: orderData(s, null, { orderNumber: `CHK-${s}-B` }),
        });
    });
    await expectFailure("Duplicate order number", async (tx) => {
        const { s } = await fixtures(tx);
        await tx.order.create({ data: orderData(s, null) });
        await tx.order.create({
            data: orderData(s, null, { idempotencyKey: `idem-${s}-B` }),
        });
    });

    // ---- Order lines ----
    await expectFailure("Order line total that does not match price x quantity", async (tx) => {
        const { s, variant } = await fixtures(tx);
        await tx.order.create({
            data: {
                ...orderData(s, null),
                items: { create: [itemData(variant.id, { lineTotal: "1" })] },
            },
        });
    });

    await expectFailure("Order line with quantity 0", async (tx) => {
        const { s, variant } = await fixtures(tx);
        await tx.order.create({
            data: {
                ...orderData(s, null),
                items: {
                    create: [itemData(variant.id, { quantity: 0, discountAmount: "0", lineTotal: "0" })],
                },
            },
        });
    });

    // ---- Payments ----
    await expectFailure("Same payment provider reference used twice", async (tx) => {
        const { s } = await fixtures(tx);
        const order = await tx.order.create({ data: orderData(s, null) });
        const base = {
            orderId: order.id,
            method: "ONLINE_GATEWAY" as const,
            provider: "dev-gateway",
            amount: "88000",
            providerReference: `dup-${s}`,
        };;
        await tx.payment.create({ data: base });
        await tx.payment.create({ data: base });
    });

    await expectFailure("Same webhook event processed twice", async (tx) => {
        const { s } = await fixtures(tx);
        const data = { source: "payment:dev-gateway", eventId: `evt-${s}` };
        await tx.processedWebhookEvent.create({ data });
        await tx.processedWebhookEvent.create({ data });
    });

    // ---- Coupons ----
    await expectFailure("Percentage coupon of 150%", async (tx) => {
        const { s } = await fixtures(tx);
        await tx.coupon.create({
            data: { code: `CHECK${s.toUpperCase()}`, discountType: "PERCENTAGE", value: "150" },
        });
    });

    await expectFailure("Coupon code in lowercase", async (tx) => {
        const { s } = await fixtures(tx);
        await tx.coupon.create({
            data: { code: `check${s}`, discountType: "FIXED_AMOUNT", value: "1000" },
        });
    });

    await expectFailure("Coupon used more times than its limit", async (tx) => {
        const { s } = await fixtures(tx);
        await tx.coupon.create({
            data: {
                code: `CHECK${s.toUpperCase()}`,
                discountType: "FIXED_AMOUNT",
                value: "1000",
                usageLimit: 5,
                usedCount: 6,
            },
        });
    });

    await expectFailure("Same order redeeming two coupons", async (tx) => {
        const { s } = await fixtures(tx);
        const order = await tx.order.create({ data: orderData(s, null) });
        const c1 = await tx.coupon.create({
            data: { code: `CHECKA${s.toUpperCase()}`, discountType: "FIXED_AMOUNT", value: "1000" },
        });
        const c2 = await tx.coupon.create({
            data: { code: `CHECKB${s.toUpperCase()}`, discountType: "FIXED_AMOUNT", value: "1000" },
        });
        const base = { orderId: order.id, customerPhone: "+959000000000", discountAmount: "1000" };
        await tx.couponRedemption.create({ data: { ...base, couponId: c1.id } });
        await tx.couponRedemption.create({ data: { ...base, couponId: c2.id } });
    });

    // ---- Reservations ----
    await expectFailure("Reservation with quantity 0", async (tx) => {
        const { s, variant } = await fixtures(tx);
        await tx.inventoryReservation.create({
            data: {
                checkoutSessionId: `sess-${s}`,
                variantId: variant.id,
                quantity: 0,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });
    });

    await expectFailure("Two reservations for the same variant in one checkout", async (tx) => {
        const { s, variant } = await fixtures(tx);
        const data = {
            checkoutSessionId: `sess-${s}`,
            variantId: variant.id,
            quantity: 1,
            expiresAt: new Date(Date.now() + 60_000),
        };
        await tx.inventoryReservation.create({ data });
        await tx.inventoryReservation.create({ data });
    });

    const orders = await prisma.order.count({ where: { orderNumber: { startsWith: "CHK-" } } });
    const users = await prisma.user.count({ where: { email: { startsWith: "check-" } } });
    console.log(
        orders === 0 && users === 0
            ? "✅ No test data left in the database"
            : `❌ Leftovers: ${orders} orders, ${users} users`,
    );
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());