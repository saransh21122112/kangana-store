-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "ratePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitType" TEXT NOT NULL DEFAULT 'Pcs';

-- CreateIndex
CREATE INDEX "InventoryItem_brand_idx" ON "InventoryItem"("brand");
