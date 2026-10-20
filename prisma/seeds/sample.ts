import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../../src/generated/prisma/client";

type Audience = "WOMEN" | "MEN" | "UNISEX" | "KIDS";

interface SampleProduct {
  slug: string;
  code: string;
  name: string;
  categorySlug: string;
  audience: Audience;
  price: number;
  salePrice?: number;
  featured?: boolean;
  sizes: string[];
  colors: { name: string; hex: string }[];
  material: string;
  tone: string; // placeholder image background
}

// Burmese names are starter translations. Please have a native speaker review them.
const CATEGORIES = [
    {
        slug: "women",
        name: "Women",
        nameMy: "အမျိုးသမီး",
        children: [
            { slug: "women-dresses", name: "Dresses", nameMy: "ဂါဝန်" },
            { slug: "women-tops", name: "Tops", nameMy: "အင်္ကျီ" },
        ],
    },
    {
        slug: "men",
        name: "Men",
        nameMy: "အမျိုးသား",
        children: [
            { slug: "men-shirts", name: "Shirts", nameMy: "ရှပ်အင်္ကျီ" },
            { slug: "men-trousers", name: "Trousers", nameMy: "ဘောင်းဘီ" },
        ],
    },
    {
        slug: "accessories",
        name: "Accessories",
        nameMy: "အပိုပစ္စည်းများ",
        children: [{ slug: "accessories-bags", name: "Bags", nameMy: "အိတ်" }],
    },
];

const PRODUCTS: SampleProduct[] = [
  {
    slug: "sample-linen-shirt", code: "LSH", name: "Sample Linen Shirt",
    categorySlug: "men-shirts", audience: "MEN", price: 45000, salePrice: 38000, featured: true,
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "White", hex: "#F5F5F0" }, { name: "Navy", hex: "#1F2A44" }],
    material: "100% linen", tone: "#E4E9E1",
  },
  {
    slug: "sample-oxford-shirt", code: "OXS", name: "Sample Oxford Shirt",
    categorySlug: "men-shirts", audience: "MEN", price: 52000,
    sizes: ["S", "M", "L", "XL"],
    colors: [{ name: "Sky", hex: "#BFD4E6" }, { name: "White", hex: "#F5F5F0" }],
    material: "Cotton oxford", tone: "#DCE6EE",
  },
  {
    slug: "sample-chino-trousers", code: "CHN", name: "Sample Chino Trousers",
    categorySlug: "men-trousers", audience: "MEN", price: 58000,
    sizes: ["30", "32", "34", "36"],
    colors: [{ name: "Khaki", hex: "#C2B280" }, { name: "Black", hex: "#1F1F1F" }],
    material: "Stretch cotton twill", tone: "#E9E3D2",
  },
  {
    slug: "sample-floral-midi-dress", code: "FMD", name: "Sample Floral Midi Dress",
    categorySlug: "women-dresses", audience: "WOMEN", price: 68000, salePrice: 59000, featured: true,
    sizes: ["S", "M", "L"],
    colors: [{ name: "Cream", hex: "#F3EBDD" }, { name: "Sage", hex: "#9DB5A0" }],
    material: "Viscose", tone: "#EFE6D8",
  },
  {
    slug: "sample-wrap-dress", code: "WRD", name: "Sample Wrap Dress",
    categorySlug: "women-dresses", audience: "WOMEN", price: 75000, featured: true,
    sizes: ["S", "M", "L"],
    colors: [{ name: "Forest", hex: "#47745B" }, { name: "Black", hex: "#1F1F1F" }],
    material: "Crepe", tone: "#DDE7E0",
  },
  {
    slug: "sample-ribbed-top", code: "RBT", name: "Sample Ribbed Top",
    categorySlug: "women-tops", audience: "WOMEN", price: 28000,
    sizes: ["S", "M", "L"],
    colors: [{ name: "Black", hex: "#1F1F1F" }, { name: "Cream", hex: "#F3EBDD" }],
    material: "Cotton blend rib", tone: "#ECE8E0",
  },
  {
    slug: "sample-silk-blouse", code: "SKB", name: "Sample Silk Blouse",
    categorySlug: "women-tops", audience: "WOMEN", price: 48000,
    sizes: ["S", "M", "L"],
    colors: [{ name: "Ivory", hex: "#F7F2E8" }, { name: "Blush", hex: "#E8C9C1" }],
    material: "Silk blend", tone: "#F1E4DF",
  },
  {
    slug: "sample-canvas-tote", code: "CTB", name: "Sample Canvas Tote",
    categorySlug: "accessories-bags", audience: "UNISEX", price: 25000,
    sizes: ["Free Size"],
    colors: [{ name: "Natural", hex: "#E8DCC4" }, { name: "Black", hex: "#1F1F1F" }],
    material: "Heavy canvas", tone: "#EAE2D0",
  },
];

// A mix of normal, low and zero stock so the UI states can be tested
const STOCK_PATTERN = [12, 12, 2, 0, 8, 15, 12, 3];

function writePlaceholder(slug: string, name: string, tone: string) {
  const dir = path.join(process.cwd(), "public", "sample");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.svg`);
  if (existsSync(file)) return;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
<rect width="800" height="1000" fill="${tone}"/>
<text x="400" y="480" font-family="Georgia, serif" font-size="44" text-anchor="middle" fill="#20211F">${name}</text>
<text x="400" y="540" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#73756F">SAMPLE IMAGE</text>
</svg>`;
  writeFileSync(file, svg);
}

export async function seedSample(prisma: PrismaClient) {
  // ---- Categories ----
  const categoryId = new Map<string, string>();
  for (const [pi, parent] of CATEGORIES.entries()) {
    const p = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: {},
      create: { slug: parent.slug, name: parent.name, nameMy: parent.nameMy, sortOrder: pi },
    });
    categoryId.set(parent.slug, p.id);
    for (const [ci, child] of parent.children.entries()) {
      const c = await prisma.category.upsert({
        where: { slug: child.slug },
        update: {},
        create: {
          slug: child.slug, name: child.name, nameMy: child.nameMy,
          parentId: p.id, sortOrder: ci,
        },
      });
      categoryId.set(child.slug, c.id);
    }
  }

  // ---- Products, variants, stock history ----
  for (const [index, sp] of PRODUCTS.entries()) {
    const catId = categoryId.get(sp.categorySlug);
    if (!catId) throw new Error(`Unknown category ${sp.categorySlug}`);

    writePlaceholder(sp.slug, sp.name, sp.tone);

    const product = await prisma.product.upsert({
      where: { slug: sp.slug },
      update: {},
      create: {
        slug: sp.slug,
        name: sp.name,
        description: `Sample product for development only. Replace it with your own products in the admin. Material: ${sp.material}.`,
        categoryId: catId,
        audience: sp.audience,
        status: "ACTIVE",
        price: sp.price,
        salePrice: sp.salePrice,
        isFeatured: Boolean(sp.featured),
        soldCount: ((index * 13) % 40) + 5,
        publishedAt: new Date(),
        images: { create: [{ url: `/sample/${sp.slug}.svg`, alt: sp.name, sortOrder: 0 }] },
        specs: { create: [{ label: "Material", value: sp.material, sortOrder: 0 }] },
      },
    });

    let n = 0;
    for (const size of sp.sizes) {
      for (const color of sp.colors) {
        const stock = STOCK_PATTERN[n % STOCK_PATTERN.length] ?? 10;
        const sku = `SAMPLE-${sp.code}-${size.replace(/\s+/g, "")}-${color.name.slice(0, 3).toUpperCase()}`;
        const existing = await prisma.productVariant.findUnique({ where: { sku } });
        if (!existing) {
          const variant = await prisma.productVariant.create({
            data: {
              productId: product.id, sku, size, color: color.name, colorHex: color.hex,
              stockOnHand: stock, sortOrder: n,
            },
          });
          if (stock > 0) {
            await prisma.inventoryMovement.create({
              data: {
                variantId: variant.id, type: "INITIAL",
                quantityChange: stock, quantityAfter: stock, reason: "Sample data",
              },
            });
          }
        }
        n++;
      }
    }
  }

  // ---- Delivery (all fees are sample values) ----
  const inHouse = await prisma.carrier.upsert({
    where: { code: "in-house" },
    update: {},
    create: { code: "in-house", name: "Our delivery team", type: "IN_HOUSE" },
  });
  const mock = await prisma.carrier.upsert({
    where: { code: "mock-express" },
    update: {},
    create: {
      code: "mock-express", name: "Mock Express (simulated)", type: "THIRD_PARTY",
      trackingUrlTemplate: "https://example.com/track/{trackingNumber}",
    },
  });

  const inHouseMethod = await prisma.shippingMethod.upsert({
    where: { code: "in-house-standard" },
    update: {},
    create: {
      code: "in-house-standard", name: "Own delivery team (sample fees)", type: "IN_HOUSE",
      carrierId: inHouse.id, etaMinDays: 1, etaMaxDays: 2, sortOrder: 0,
    },
  });
  const mockMethod = await prisma.shippingMethod.upsert({
    where: { code: "mock-express-standard" },
    update: {},
    create: {
      code: "mock-express-standard", name: "Courier delivery (simulated, sample fees)",
      type: "THIRD_PARTY", carrierId: mock.id, etaMinDays: 2, etaMaxDays: 5, sortOrder: 1,
    },
  });

  const ZONES = [
    { region: "Yangon Region", township: "Bahan" },
    { region: "Yangon Region", township: "Sanchaung" },
    { region: "Yangon Region", township: "Kamayut" },
    { region: "Yangon Region", township: "Hlaing" },
    { region: "Yangon Region", township: "Mayangone" },
    { region: "Yangon Region", township: "Tamwe" },
    { region: "Mandalay Region", township: "Chanayethazan" },
    { region: "Mandalay Region", township: "Aungmyaethazan" },
    { region: "Mandalay Region", township: "Chanmyathazi" },
  ];

  for (const [i, z] of ZONES.entries()) {
    const zone = await prisma.deliveryZone.upsert({
      where: { region_township: { region: z.region, township: z.township } },
      update: {},
      create: { name: z.township, region: z.region, township: z.township, sortOrder: i },
    });
    const isYangon = z.region === "Yangon Region";

    // Our own team only covers Yangon in this sample
    if (isYangon) {
      await prisma.shippingRate.upsert({
        where: { methodId_zoneId: { methodId: inHouseMethod.id, zoneId: zone.id } },
        update: {},
        create: {
          methodId: inHouseMethod.id, zoneId: zone.id, fee: 2500, freeShippingOver: 80000,
        },
      });
    }
    await prisma.shippingRate.upsert({
      where: { methodId_zoneId: { methodId: mockMethod.id, zoneId: zone.id } },
      update: {},
      create: { methodId: mockMethod.id, zoneId: zone.id, fee: isYangon ? 3500 : 4500 },
    });
  }

  // ---- Sample coupon ----
  await prisma.coupon.upsert({
    where: { code: "SAMPLE10" },
    update: {},
    create: {
      code: "SAMPLE10", description: "Sample: 10% off, up to 10,000 Ks",
      discountType: "PERCENTAGE", value: 10, maxDiscountAmount: 10000, minOrderAmount: 30000,
    },
  });
}