-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('merchant', 'admin');

-- CreateEnum
CREATE TYPE "period_status" AS ENUM ('draft', 'calculated', 'validated', 'closed');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('running', 'success', 'error');

-- CreateEnum
CREATE TYPE "allocation_rule_type" AS ENUM ('linear_meters', 'equal_share', 'custom_percentage', 'specific_merchant');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "halls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hall_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "pennylane_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'merchant',
    "merchant_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_hall_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "hall_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_hall_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_hall_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL,
    "hall_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_hall_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hall_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "linear_meters" DECIMAL(10,3) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_charge_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hall_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "period_status" NOT NULL DEFAULT 'draft',
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_charge_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hall_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" "allocation_rule_type" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hall_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "allocation_rule_id" UUID,
    "amount_excl_tax" DECIMAL(14,2) NOT NULL,
    "amount_tax" DECIMAL(14,2) NOT NULL,
    "amount_incl_tax" DECIMAL(14,2) NOT NULL,
    "pennylane_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_id" UUID NOT NULL,
    "service_charge_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "stand_id" UUID NOT NULL,
    "merchant_linear_meters" DECIMAL(10,3) NOT NULL,
    "total_linear_meters" DECIMAL(10,3) NOT NULL,
    "allocation_percentage" DECIMAL(9,6) NOT NULL,
    "allocated_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pennylane_syncs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hall_id" UUID NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" "sync_status" NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pennylane_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "halls_organization_id_name_key" ON "halls"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_hall_id_legal_name_key" ON "merchants"("hall_id", "legal_name");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_hall_id_pennylane_id_key" ON "merchants"("hall_id", "pennylane_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_hall_permissions_profile_id_hall_id_key" ON "admin_hall_permissions"("profile_id", "hall_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_hall_permissions_profile_id_hall_id_key" ON "merchant_hall_permissions"("profile_id", "hall_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_charge_periods_hall_id_label_key" ON "service_charge_periods"("hall_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_rules_hall_id_name_key" ON "allocation_rules"("hall_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "service_charges_hall_id_pennylane_id_key" ON "service_charges"("hall_id", "pennylane_id");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_service_charge_id_merchant_id_key" ON "allocations"("service_charge_id", "merchant_id");

-- AddForeignKey
ALTER TABLE "halls" ADD CONSTRAINT "halls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_hall_permissions" ADD CONSTRAINT "admin_hall_permissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_hall_permissions" ADD CONSTRAINT "admin_hall_permissions_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_hall_permissions" ADD CONSTRAINT "merchant_hall_permissions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_hall_permissions" ADD CONSTRAINT "merchant_hall_permissions_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stands" ADD CONSTRAINT "stands_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stands" ADD CONSTRAINT "stands_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_charge_periods" ADD CONSTRAINT "service_charge_periods_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "service_charge_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_charges" ADD CONSTRAINT "service_charges_allocation_rule_id_fkey" FOREIGN KEY ("allocation_rule_id") REFERENCES "allocation_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "service_charge_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_service_charge_id_fkey" FOREIGN KEY ("service_charge_id") REFERENCES "service_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_stand_id_fkey" FOREIGN KEY ("stand_id") REFERENCES "stands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pennylane_syncs" ADD CONSTRAINT "pennylane_syncs_hall_id_fkey" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

