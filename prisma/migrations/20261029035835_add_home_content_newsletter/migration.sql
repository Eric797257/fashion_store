/*
  Warnings:

  - You are about to drop the column `privacy_policy` on the `store_settings` table. All the data in the column will be lost.
  - You are about to drop the column `return_policy` on the `store_settings` table. All the data in the column will be lost.
  - You are about to drop the column `shipping_policy` on the `store_settings` table. All the data in the column will be lost.
  - You are about to drop the column `terms` on the `store_settings` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('HERO', 'PROMO');

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED');

-- AlterTable
ALTER TABLE "store_settings" DROP COLUMN "privacy_policy",
DROP COLUMN "return_policy",
DROP COLUMN "shipping_policy",
DROP COLUMN "terms";

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "placement" "BannerPlacement" NOT NULL,
    "title" TEXT NOT NULL,
    "title_my" TEXT,
    "subtitle" TEXT,
    "subtitle_my" TEXT,
    "cta_label" TEXT,
    "cta_label_my" TEXT,
    "cta_href" TEXT NOT NULL,
    "image_url" TEXT,
    "image_alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "author_location" TEXT,
    "quote" TEXT NOT NULL,
    "quote_my" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_my" TEXT,
    "body" TEXT NOT NULL,
    "body_my" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'PENDING',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "confirm_token_hash" TEXT,
    "confirm_expires_at" TIMESTAMP(3),
    "confirm_sent_at" TIMESTAMP(3),
    "unsubscribe_token" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_placement_is_active_sort_order_idx" ON "banners"("placement", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "testimonials_is_active_sort_order_idx" ON "testimonials"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_key" ON "newsletter_subscribers"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers"("status");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_confirm_token_hash_idx" ON "newsletter_subscribers"("confirm_token_hash");

-- Banner links must stay inside this site ("/" or "/something", never "//host" or "/\host")
ALTER TABLE "banners"
  ADD CONSTRAINT "banners_href_internal"
  CHECK ("cta_href" ~ '^/($|[^/\\])');

ALTER TABLE "banners"
  ADD CONSTRAINT "banners_schedule_valid"
  CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at");

ALTER TABLE "testimonials"
  ADD CONSTRAINT "testimonials_rating_valid" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "content_pages"
  ADD CONSTRAINT "content_pages_slug_valid" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "newsletter_subscribers"
  ADD CONSTRAINT "newsletter_subscribers_email_lowercase" CHECK ("email" = lower("email"));