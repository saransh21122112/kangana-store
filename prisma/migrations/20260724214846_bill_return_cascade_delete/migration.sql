-- DropForeignKey
ALTER TABLE "BillReturn" DROP CONSTRAINT "BillReturn_lineItemId_fkey";

-- AddForeignKey
ALTER TABLE "BillReturn" ADD CONSTRAINT "BillReturn_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "BillLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
