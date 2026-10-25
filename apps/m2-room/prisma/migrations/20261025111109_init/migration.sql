-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "room_bookings" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "attendees" INTEGER NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "requiredLevels" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_bookings_roomId_from_to_idx" ON "room_bookings"("roomId", "from", "to");

-- CreateIndex
CREATE INDEX "room_bookings_applicantId_createdAt_idx" ON "room_bookings"("applicantId", "createdAt");

-- CreateIndex
CREATE INDEX "room_bookings_status_expiresAt_idx" ON "room_bookings"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "approval_records_bookingId_level_key" ON "approval_records"("bookingId", "level");

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "room_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
