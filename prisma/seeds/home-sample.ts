import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "../../src/generated/prisma/client";

function placeholder(file: string, width: number, height: number, tone: string, label: string) {
  const dir = path.join(process.cwd(), "public", "sample");
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, file);
  if (existsSync(target)) return;
  writeFileSync(
    target,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="${tone}"/>
<text x="50%" y="50%" font-family="Arial, sans-serif" font-size="28" text-anchor="middle" fill="#20211F" fill-opacity="0.45">${label}</text>
</svg>`,
  );
}

const STARTER = "[STARTER DRAFT: replace this with your own text and have it reviewed before launch]";

const PAGES: { slug: string; title: string; titleMy: string; body: string[] }[] = [
  {
    slug: "about",
    title: "About us",
    titleMy: "ကျွန်ုပ်တို့အကြောင်း",
    body: [
      STARTER,
      "## Our story",
      "We are a Myanmar fashion brand making everyday clothing that is comfortable, well made and fairly priced. [Write your own story here: who you are, where you started, what you care about.]",
      "## What we offer",
      "- Women's and men's clothing and accessories",
      "- Delivery by our own team and trusted couriers",
      "- Cash on delivery and online payment",
    ],
  },
  {
    slug: "shipping-policy",
    title: "Shipping policy",
    titleMy: "ပို့ဆောင်ရေး မူဝါဒ",
    body: [
      STARTER,
      "## Where we deliver",
      "We deliver to the townships shown at checkout. Delivery fees depend on your township and are shown before you place the order.",
      "## How long it takes",
      "Orders are packed after confirmation. Your township's estimated delivery time is shown at checkout. [Add your usual times for Yangon and other regions.]",
      "## Delivery by our own team or a courier",
      "Depending on your address, your order is delivered by our own riders or by a courier company. You can follow it on the Track order page with your order number.",
      "## Paying cash on delivery",
      "If you chose cash on delivery, please have the exact amount ready. The rider will confirm the amount with you.",
      "## If we can't reach you",
      "[Describe how many delivery attempts you make and what happens afterwards.]",
    ],
  },
  {
    slug: "return-policy",
    title: "Return policy",
    titleMy: "ပြန်လည်လဲလှယ်ရေး မူဝါဒ",
    body: [
      STARTER,
      "## Returns and exchanges",
      "You can ask to return or exchange an item within 7 days of delivery if it is unworn, unwashed and has its tags.",
      "## How to start",
      "Contact us with your order number and tell us which item and why. We will explain the next step.",
      "## Refunds",
      "[Describe how refunds are paid: cash, mobile wallet or bank transfer, and how long it takes.]",
      "## Items we can't take back",
      "[List any exceptions, such as underwear or sale items.]",
    ],
  },
  {
    slug: "privacy-policy",
    title: "Privacy policy",
    titleMy: "ကိုယ်ရေးအချက်အလက် မူဝါဒ",
    body: [
      STARTER,
      "## What we collect",
      "- Your name, phone number, email address and delivery address when you order or create an account",
      "- Your orders, wishlist and reviews",
      "- Technical information needed to keep the site working and secure",
      "## How we use it",
      "To process and deliver your orders, contact you about them, keep your account safe and, if you subscribe, send you news and offers.",
      "## Who we share it with",
      "Only with the people who help us deliver your order, such as our riders and courier companies, and with payment providers when you pay online. We do not sell your data.",
      "## Cookies",
      "We use cookies to remember your language, keep you signed in and keep your cart.",
      "## How long we keep it",
      "[State how long you keep order and account records.]",
      "## Your choices",
      "You can ask to see or correct your data, and you can unsubscribe from emails at any time.",
      "## Deleting your account and data",
      "To delete your account and personal data, email us from the address on your account and ask us to delete it. We will confirm by email once it is done. Some order records may be kept where the law requires it.",
      "## Contact",
      "Questions about this policy? Use the details on the Contact page.",
    ],
  },
  {
    slug: "terms",
    title: "Terms and conditions",
    titleMy: "စည်းမျဉ်းစည်းကမ်းများ",
    body: [
      STARTER,
      "## Orders",
      "An order is accepted when we confirm it. We may cancel an order if an item is unavailable or a price was shown by mistake, and we will tell you and refund anything you paid.",
      "## Prices and payment",
      "Prices are in Myanmar kyat (MMK). You can pay cash on delivery or online where offered.",
      "## Delivery and returns",
      "Delivery and returns are explained in our shipping and return policies.",
      "## Accounts",
      "Please keep your password private. Tell us if you think someone else has used your account.",
      "## Responsibility",
      "[Add your limits of responsibility.]",
      "## Governing law",
      "[Confirm the governing law and where disputes are handled with your lawyer.]",
    ],
  },
  {
    slug: "contact",
    title: "Contact us",
    titleMy: "ကျွန်ုပ်တို့ကို ဆက်သွယ်ရန်",
    body: [
      "Questions about an order, delivery or sizing? Reach us in any of the ways below.",
    ],
  },
];

export async function seedHomeSample(prisma: PrismaClient) {
  placeholder("banner-hero.svg", 1600, 900, "#DCE6DF", "SAMPLE BANNER");
  placeholder("banner-promo-1.svg", 1000, 640, "#EFE6D8", "SAMPLE BANNER");
  placeholder("banner-promo-2.svg", 1000, 640, "#DDE3EA", "SAMPLE BANNER");

  const banners = [
    {
      placement: "HERO" as const,
      title: "New season, new favourites",
      titleMy: "ရာသီသစ်၊ အကြိုက်သစ်များ",
      subtitle: "Sample banner. Replace this text and image in the admin.",
      subtitleMy: "နမူနာ ဘန်နာ။ အက်ဒမင်တွင် ဤစာသားနှင့် ပုံကို လဲလှယ်ပါ။",
      ctaLabel: "Shop now",
      ctaLabelMy: "ဈေးဝယ်ရန်",
      ctaHref: "/products",
      imageUrl: "/sample/banner-hero.svg",
      imageAlt: "Sample banner",
      sortOrder: 0,
    },
    {
      placement: "PROMO" as const,
      title: "Shop women",
      titleMy: "အမျိုးသမီးများအတွက်",
      ctaLabel: "Explore",
      ctaLabelMy: "ကြည့်ရှုရန်",
      ctaHref: "/categories/women",
      imageUrl: "/sample/banner-promo-1.svg",
      imageAlt: "Sample banner",
      sortOrder: 0,
    },
    {
      placement: "PROMO" as const,
      title: "Shop men",
      titleMy: "အမျိုးသားများအတွက်",
      ctaLabel: "Explore",
      ctaLabelMy: "ကြည့်ရှုရန်",
      ctaHref: "/categories/men",
      imageUrl: "/sample/banner-promo-2.svg",
      imageAlt: "Sample banner",
      sortOrder: 1,
    },
  ];
  for (const banner of banners) {
    const exists = await prisma.banner.findFirst({
      where: { placement: banner.placement, title: banner.title },
      select: { id: true },
    });
    if (!exists) await prisma.banner.create({ data: banner });
  }

  const testimonials = [
    {
      authorName: "Sample customer",
      authorLocation: "Yangon",
      quote: "This is a sample testimonial. Replace it with real customer feedback.",
    },
    {
      authorName: "Sample customer",
      authorLocation: "Mandalay",
      quote: "Another sample testimonial. Only show quotes you have permission to use.",
    },
    {
      authorName: "Sample customer",
      authorLocation: "Naypyitaw",
      quote: "A third sample testimonial, shown to test the layout.",
    },
  ];
  for (const [index, testimonial] of testimonials.entries()) {
    const exists = await prisma.testimonial.findFirst({
      where: { quote: testimonial.quote },
      select: { id: true },
    });
    if (!exists) await prisma.testimonial.create({ data: { ...testimonial, sortOrder: index } });
  }

  for (const page of PAGES) {
    await prisma.contentPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: { slug: page.slug, title: page.title, titleMy: page.titleMy, body: page.body.join("\n\n") },
    });
  }
}