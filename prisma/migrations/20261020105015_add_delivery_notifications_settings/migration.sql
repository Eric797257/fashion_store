-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('IN_HOUSE', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED_TO_SENDER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TrackingSource" AS ENUM ('SYSTEM', 'ADMIN', 'RIDER', 'CARRIER_WEBHOOK', 'CARRIER_POLL', 'SIMULATED');

-- CreateEnum
CREATE TYPE "CodStatus" AS ENUM ('PENDING', 'COLLECTED', 'RECONCILED', 'DISCREPANCY');

-- CreateEnum
CREATE TYPE "RiderStatus" AS ENUM ('OFF_DUTY', 'AVAILABLE', 'ON_DELIVERY');

-- CreateEnum
CREATE TYPE "OutboxChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FulfillmentType" NOT NULL,
    "tracking_url_template" TEXT,
    "support_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "township" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FulfillmentType" NOT NULL,
    "carrier_id" TEXT,
    "cod_available" BOOLEAN NOT NULL DEFAULT true,
    "eta_min_days" INTEGER NOT NULL DEFAULT 1,
    "eta_max_days" INTEGER NOT NULL DEFAULT 3,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rates" (
    "id" TEXT NOT NULL,
    "method_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "fee" DECIMAL(14,2) NOT NULL,
    "free_shipping_over" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicle_type" TEXT,
    "vehicle_plate" TEXT,
    "status" "RiderStatus" NOT NULL DEFAULT 'OFF_DUTY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rider_zones" (
    "rider_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,

    CONSTRAINT "rider_zones_pkey" PRIMARY KEY ("rider_id","zone_id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" "FulfillmentType" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "carrier_id" TEXT,
    "rider_id" TEXT,
    "tracking_number" TEXT,
    "carrier_reference" TEXT,
    "estimated_delivery_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "delivery_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_failure_reason" TEXT,
    "delivery_notes" TEXT,
    "proof_of_delivery_url" TEXT,
    "received_by" TEXT,
    "cod_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "failure_reason" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "source" "TrackingSource" NOT NULL,
    "is_simulated" BOOLEAN NOT NULL DEFAULT false,
    "carrier_event_id" TEXT,
    "actor_id" TEXT,
    "raw_pay_load" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cod_collections" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "rider_id" TEXT,
    "amount_due" DECIMAL(14,2) NOT NULL,
    "amount_collected" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "CodStatus" NOT NULL DEFAULT 'PENDING',
    "collected_at" TIMESTAMP(3),
    "reconciled_at" TIMESTAMP(3),
    "reconciled_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cod_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "data" JSONB,
    "dedupe_key" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_order_updates" BOOLEAN NOT NULL DEFAULT true,
    "email_promotions" BOOLEAN NOT NULL DEFAULT false,
    "sms_order_updates" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" TEXT NOT NULL,
    "channel" "OutboxChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MMK',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Yangon',
    "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_label" TEXT NOT NULL DEFAULT 'Commercial tax',
    "guest_checkout_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cod_enabled" BOOLEAN NOT NULL DEFAULT true,
    "manual_transfer_enabled" BOOLEAN NOT NULL DEFAULT true,
    "online_gateway_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reservation_minutes" INTEGER NOT NULL DEFAULT 15,
    "unpaid_order_expiry_hours" INTEGER NOT NULL DEFAULT 24,
    "return_window_days" INTEGER NOT NULL DEFAULT 7,
    "support_phone" TEXT,
    "support_email" TEXT,
    "manual_transfer_accounts" JSONB,
    "shipping_policy" TEXT,
    "return_policy" TEXT,
    "privacy_policy" TEXT,
    "terms" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carriers_code_key" ON "carriers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_region_township_key" ON "delivery_zones"("region", "township");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_methods_code_key" ON "shipping_methods"("code");

-- CreateIndex
CREATE INDEX "shipping_methods_is_active_sort_order_idx" ON "shipping_methods"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "shipping_rates_zone_id_idx" ON "shipping_rates"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rates_method_id_zone_id_key" ON "shipping_rates"("method_id", "zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "riders_user_id_key" ON "riders"("user_id");

-- CreateIndex
CREATE INDEX "riders_is_active_status_idx" ON "riders"("is_active", "status");

-- CreateIndex
CREATE INDEX "rider_zones_zone_id_idx" ON "rider_zones"("zone_id");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_created_at_idx" ON "shipments"("status", "created_at");

-- CreateIndex
CREATE INDEX "shipments_rider_id_status_idx" ON "shipments"("rider_id", "status");

-- CreateIndex
CREATE INDEX "shipments_carrier_id_status_idx" ON "shipments"("carrier_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_carrier_id_tracking_number_key" ON "shipments"("carrier_id", "tracking_number");

-- CreateIndex
CREATE INDEX "tracking_events_shipment_id_occurred_at_idx" ON "tracking_events"("shipment_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_events_shipment_id_carrier_event_id_key" ON "tracking_events"("shipment_id", "carrier_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "cod_collections_shipment_id_key" ON "cod_collections"("shipment_id");

-- CreateIndex
CREATE INDEX "cod_collections_status_created_at_idx" ON "cod_collections"("status", "created_at");

-- CreateIndex
CREATE INDEX "cod_collections_rider_id_status_idx" ON "cod_collections"("rider_id", "status");

-- CreateIndex
CREATE INDEX "cod_collections_order_id_idx" ON "cod_collections"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_messages_dedupe_key_key" ON "outbox_messages"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_messages_status_next_attempt_at_idx" ON "outbox_messages"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "shipping_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rates" ADD CONSTRAINT "shipping_rates_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_zones" ADD CONSTRAINT "rider_zones_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_zones" ADD CONSTRAINT "rider_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "carriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_collections" ADD CONSTRAINT "cod_collections_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_collections" ADD CONSTRAINT "cod_collections_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_collections" ADD CONSTRAINT "cod_collections_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "riders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ===== Shipping methods and rates =====
ALTER TABLE "shipping_methods"
  ADD CONSTRAINT "shipping_methods_carrier_required"
  CHECK ("type" = 'IN_HOUSE' OR "carrier_id" IS NOT NULL);

ALTER TABLE "shipping_methods"
  ADD CONSTRAINT "shipping_methods_eta_valid"
  CHECK ("eta_min_days" >= 0 AND "eta_max_days" >= "eta_min_days");

ALTER TABLE "shipping_rates"
  ADD CONSTRAINT "shipping_rates_amounts_valid"
  CHECK ("fee" >= 0 AND ("free_shipping_over" IS NULL OR "free_shipping_over" >= 0));

-- ===== Shipments =====
ALTER TABLE "shipments"
  ADD CONSTRAINT "shipments_rules_valid"
  CHECK (
    ("type" = 'IN_HOUSE' OR "carrier_id" IS NOT NULL)
    AND "delivery_attempts" >= 0
    AND "cod_amount" >= 0
  );

-- ===== Tracking: simulated flag must match the source =====
ALTER TABLE "tracking_events"
  ADD CONSTRAINT "tracking_events_simulated_matches_source"
  CHECK ("is_simulated" = ("source" = 'SIMULATED'));

-- ===== COD cash =====
ALTER TABLE "cod_collections"
  ADD CONSTRAINT "cod_collections_rules_valid"
  CHECK (
    "amount_due" > 0
    AND "amount_collected" >= 0
    AND ("status" = 'PENDING' OR "collected_at" IS NOT NULL)
    AND ("status" <> 'RECONCILED' OR "reconciled_at" IS NOT NULL)
  );

-- ===== Store settings: exactly one row, sensible values =====
ALTER TABLE "store_settings"
  ADD CONSTRAINT "store_settings_rules_valid"
  CHECK (
    "id" = 'default'
    AND "tax_rate" >= 0 AND "tax_rate" <= 100
    AND "reservation_minutes" BETWEEN 1 AND 120
    AND "unpaid_order_expiry_hours" BETWEEN 1 AND 720
    AND "return_window_days" >= 0
  );