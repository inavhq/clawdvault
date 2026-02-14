-- AlterTable
ALTER TABLE "tokens" ADD COLUMN "ath" DECIMAL(30,18),
ADD COLUMN "price_change_24h" DECIMAL(20,2),
ADD COLUMN "price_change_24h_percent" DECIMAL(10,2);
