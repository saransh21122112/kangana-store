-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_inventoryItemId_fkey";

-- DropIndex
DROP INDEX "Bill_category_idx";

-- DropIndex
DROP INDEX "Bill_inventoryItemId_idx";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "category",
DROP COLUMN "inventoryItemId",
DROP COLUMN "quantitySold";

