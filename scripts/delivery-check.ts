import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

class Rollback extends Error {}
type Tx = Prisma.TransactionClient;

const rand = () => Math.random().toString(36).slice(2, 8);

/** A user, an order and a third-party carrier. */
async function base(tx: Tx) {
  const s = rand();
  const user = await tx.user.create({
    data: {
      id: `check-user-${s}`,
      name: "Check User",
      email: `check-${s}@example.test`,
      emailVerified: false,
    },
  });
  const order = await tx.order.create({
    data: {
      orderNumber: `CHK-${s}`,
      idempotencyKey: `idem-${s}`,
      paymentMethod: "COD",
      customerName: "Test Person",
      customerPhone: "+959000000000",
      shipRecipientName: "Test Person",
      shipPhone: "+959000000000",
      shipRegion: "Yangon Region",
      shipTownship: "Bahan",
      shipAddressLine: "1 Test Street",
      shippingMethodCode: "check",
      shippingMethodName: "Check",
      subtotal: "10000",
      total: "10000",
    },
  });
  const carrier = await tx.carrier.create({
    data: { code: `check-${s}`, name: "Check Carrier", type: "THIRD_PARTY" },
  });
  return { s, user, order, carrier };
}

type Base = Awaited<ReturnType<typeof base>>;

function shipmentData(
  b: Base,
  over: Partial<Prisma.ShipmentUncheckedCreateInput> = {},
): Prisma.ShipmentUncheckedCreateInput {
  return {
    orderId: b.order.id,
    type: "THIRD_PARTY",
    carrierId: b.carrier.id,
    trackingNumber: `TRK-${b.s}`,
    codAmount: "10000",
    ...over,
  };
}

function eventData(
  shipmentId: string,
  over: Partial<Prisma.TrackingEventUncheckedCreateInput> = {},
): Prisma.TrackingEventUncheckedCreateInput {
  return {
    shipmentId,
    status: "SHIPPED",
    title: "Shipped",
    occurredAt: new Date(),
    source: "CARRIER_WEBHOOK",
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
  // ---- Happy path ----
  try {
    await prisma.$transaction(async (tx) => {
      const b = await base(tx);
      const rider = await tx.rider.create({
        data: { userId: b.user.id, phone: "+959111111111", vehicleType: "Motorbike" },
      });
      const zone = await tx.deliveryZone.create({
        data: { name: "Check Zone", region: "Check Region", township: `Check-${b.s}` },
      });
      const method = await tx.shippingMethod.create({
        data: { code: `check-m-${b.s}`, name: "Check", type: "THIRD_PARTY", carrierId: b.carrier.id },
      });
      await tx.shippingRate.create({
        data: { methodId: method.id, zoneId: zone.id, fee: "3500", freeShippingOver: "80000" },
      });
      await tx.riderZone.create({ data: { riderId: rider.id, zoneId: zone.id } });

      const shipment = await tx.shipment.create({ data: shipmentData(b) });
      await tx.trackingEvent.create({
        data: eventData(shipment.id, { carrierEventId: `ev-1-${b.s}` }),
      });
      await tx.trackingEvent.create({
        data: eventData(shipment.id, {
          status: "IN_TRANSIT",
          title: "In transit (simulated)",
          source: "SIMULATED",
          isSimulated: true,
          carrierEventId: `ev-2-${b.s}`,
        }),
      });
      await tx.codCollection.create({
        data: { shipmentId: shipment.id, orderId: b.order.id, amountDue: "10000" },
      });
      await tx.notification.create({
        data: { userId: b.user.id, type: "ORDER_SHIPPED", title: "Shipped", dedupeKey: `n-${b.s}` },
      });
      await tx.notificationPreference.create({ data: { userId: b.user.id } });
      await tx.outboxMessage.create({
        data: {
          channel: "EMAIL", recipient: "x@example.test", subject: "Hi", body: "Test",
          dedupeKey: `o-${b.s}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: b.user.id, actorRole: "ADMIN", action: "shipment.create",
          entityType: "Shipment", entityId: shipment.id,
        },
      });
      await tx.storeSettings.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default" },
      });

      console.log("✅ Full delivery chain accepted (rolled back after)");
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }

  // ---- Shipments ----
  await expectFailure("Third-party shipment without a carrier", async (tx) => {
    const b = await base(tx);
    await tx.shipment.create({ data: shipmentData(b, { carrierId: null }) });
  });

  await expectFailure("Same tracking number twice for one carrier", async (tx) => {
    const b = await base(tx);
    await tx.shipment.create({ data: shipmentData(b) });
    await tx.shipment.create({ data: shipmentData(b) });
  });

  // ---- Tracking events ----
  await expectFailure("Same carrier event delivered twice (webhook retry)", async (tx) => {
    const b = await base(tx);
    const sh = await tx.shipment.create({ data: shipmentData(b) });
    await tx.trackingEvent.create({ data: eventData(sh.id, { carrierEventId: "dup" }) });
    await tx.trackingEvent.create({ data: eventData(sh.id, { carrierEventId: "dup" }) });
  });

  await expectFailure("Simulated source not flagged as simulated", async (tx) => {
    const b = await base(tx);
    const sh = await tx.shipment.create({ data: shipmentData(b) });
    await tx.trackingEvent.create({
      data: eventData(sh.id, { source: "SIMULATED", isSimulated: false }),
    });
  });

  // ---- COD cash ----
  await expectFailure("Second COD record for one shipment", async (tx) => {
    const b = await base(tx);
    const sh = await tx.shipment.create({ data: shipmentData(b) });
    const data = { shipmentId: sh.id, orderId: b.order.id, amountDue: "10000" };
    await tx.codCollection.create({ data });
    await tx.codCollection.create({ data });
  });

  await expectFailure("COD marked reconciled without a reconciliation time", async (tx) => {
    const b = await base(tx);
    const sh = await tx.shipment.create({ data: shipmentData(b) });
    await tx.codCollection.create({
      data: {
        shipmentId: sh.id, orderId: b.order.id, amountDue: "10000", amountCollected: "10000",
        status: "RECONCILED", collectedAt: new Date(),
      },
    });
  });

  // ---- Zones and rates ----
  await expectFailure("Same township added twice as a delivery zone", async (tx) => {
    const s = rand();
    const data = { name: "Dup", region: "Check Region", township: `Check-${s}` };
    await tx.deliveryZone.create({ data });
    await tx.deliveryZone.create({ data });
  });

  await expectFailure("Same shipping method priced twice for one zone", async (tx) => {
    const b = await base(tx);
    const zone = await tx.deliveryZone.create({
      data: { name: "Z", region: "Check Region", township: `Check-${b.s}` },
    });
    const method = await tx.shippingMethod.create({
      data: { code: `check-m-${b.s}`, name: "M", type: "THIRD_PARTY", carrierId: b.carrier.id },
    });
    const data = { methodId: method.id, zoneId: zone.id, fee: "3000" };
    await tx.shippingRate.create({ data });
    await tx.shippingRate.create({ data });
  });

  await expectFailure("Negative shipping fee", async (tx) => {
    const b = await base(tx);
    const zone = await tx.deliveryZone.create({
      data: { name: "Z", region: "Check Region", township: `Check-${b.s}` },
    });
    const method = await tx.shippingMethod.create({
      data: { code: `check-m-${b.s}`, name: "M", type: "THIRD_PARTY", carrierId: b.carrier.id },
    });
    await tx.shippingRate.create({ data: { methodId: method.id, zoneId: zone.id, fee: "-1" } });
  });

  // ---- Notifications ----
  await expectFailure("Same notification created twice (dedupe key)", async (tx) => {
    const b = await base(tx);
    const data = { userId: b.user.id, type: "ORDER_SHIPPED", title: "Shipped", dedupeKey: "dup" };
    await tx.notification.create({ data });
    await tx.notification.create({ data });
  });

  // ---- Store settings ----
  await expectFailure("Second store settings row", async (tx) => {
    await tx.storeSettings.create({ data: { id: "second" } });
  });

  await expectFailure("Tax rate of 150%", async (tx) => {
    await tx.storeSettings.upsert({
      where: { id: "default" },
      update: { taxRate: "150" },
      create: { id: "default", taxRate: "150" },
    });
  });

  // ---- Cleanup check ----
  const orders = await prisma.order.count({ where: { orderNumber: { startsWith: "CHK-" } } });
  const users = await prisma.user.count({ where: { email: { startsWith: "check-" } } });
  const carriers = await prisma.carrier.count({ where: { code: { startsWith: "check-" } } });
  const zones = await prisma.deliveryZone.count({ where: { region: "Check Region" } });
  console.log(
    orders + users + carriers + zones === 0
      ? "✅ No test data left in the database"
      : `❌ Leftovers: ${orders} orders, ${users} users, ${carriers} carriers, ${zones} zones`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());