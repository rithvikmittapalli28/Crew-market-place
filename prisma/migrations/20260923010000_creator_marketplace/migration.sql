-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('FIXED', 'HOURLY', 'STARTING_FROM');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'RESPONDED', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "FreelancerProfile" ADD COLUMN     "marketplaceVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicSlug" TEXT;

-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "category" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "category" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "pricingType" "PricingType" NOT NULL DEFAULT 'FIXED';

-- CreateTable
CREATE TABLE "SavedCreator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorInquiry" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "serviceId" TEXT,
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedCreator_userId_idx" ON "SavedCreator"("userId");

-- CreateIndex
CREATE INDEX "SavedCreator_freelancerId_idx" ON "SavedCreator"("freelancerId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCreator_userId_freelancerId_key" ON "SavedCreator"("userId", "freelancerId");

-- CreateIndex
CREATE INDEX "CreatorInquiry_senderId_idx" ON "CreatorInquiry"("senderId");

-- CreateIndex
CREATE INDEX "CreatorInquiry_freelancerId_idx" ON "CreatorInquiry"("freelancerId");

-- CreateIndex
CREATE INDEX "CreatorInquiry_status_idx" ON "CreatorInquiry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerProfile_publicSlug_key" ON "FreelancerProfile"("publicSlug");

-- CreateIndex
CREATE INDEX "FreelancerProfile_marketplaceVisible_idx" ON "FreelancerProfile"("marketplaceVisible");

-- CreateIndex
CREATE INDEX "FreelancerProfile_publicSlug_idx" ON "FreelancerProfile"("publicSlug");

-- CreateIndex
CREATE INDEX "FreelancerProfile_hourlyRate_idx" ON "FreelancerProfile"("hourlyRate");

-- CreateIndex
CREATE INDEX "FreelancerProfile_yearsExperience_idx" ON "FreelancerProfile"("yearsExperience");

-- CreateIndex
CREATE INDEX "PortfolioItem_published_idx" ON "PortfolioItem"("published");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");

-- AddForeignKey
ALTER TABLE "SavedCreator" ADD CONSTRAINT "SavedCreator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCreator" ADD CONSTRAINT "SavedCreator_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorInquiry" ADD CONSTRAINT "CreatorInquiry_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorInquiry" ADD CONSTRAINT "CreatorInquiry_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorInquiry" ADD CONSTRAINT "CreatorInquiry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
