-- AlterTable
ALTER TABLE "File" ADD COLUMN "resourceType" TEXT,
ADD COLUMN "resourceId" TEXT;

-- CreateIndex
CREATE INDEX "File_resourceType_resourceId_idx" ON "File"("resourceType", "resourceId");
