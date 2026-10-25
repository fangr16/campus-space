-- CreateEnum
CREATE TYPE "SeatStatusSource" AS ENUM ('M1_RESERVATION', 'M2_ROOM_BOOKING', 'M3_REPAIR');

-- CreateEnum
CREATE TYPE "SeatStatusKind" AS ENUM ('RESERVED', 'BLOCKED');

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "openFrom" TEXT NOT NULL,
    "openTo" TEXT NOT NULL,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hasPowerOutlet" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_statuses" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "kind" "SeatStatusKind" NOT NULL,
    "source" "SeatStatusSource" NOT NULL,
    "refId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seat_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "rooms_building_idx" ON "rooms"("building");

-- CreateIndex
CREATE UNIQUE INDEX "seats_roomId_code_key" ON "seats"("roomId", "code");

-- CreateIndex
CREATE INDEX "seat_statuses_seatId_from_to_idx" ON "seat_statuses"("seatId", "from", "to");

-- CreateIndex
CREATE INDEX "seat_statuses_source_refId_idx" ON "seat_statuses"("source", "refId");

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_statuses" ADD CONSTRAINT "seat_statuses_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
