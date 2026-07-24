-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "inventoryItemId" TEXT,
ADD COLUMN     "quantitySold" INTEGER;

-- CreateIndex
CREATE INDEX "Bill_inventoryItemId_idx" ON "Bill"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
