-- AlterTable
ALTER TABLE "tokens" ADD COLUMN "ath" DECIMAL(30,18),
ADD COLUMN "price_24h_ago" DECIMAL(30,18),
ADD COLUMN "price_change_24h" DECIMAL(10,4);
