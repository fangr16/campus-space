-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('BOOKED', 'CANCELLED');

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'BOOKED',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "reservations_userId_from_idx" ON "reservations"("userId", "from");

-- CreateIndex
CREATE INDEX "reservations_seatId_from_to_idx" ON "reservations"("seatId", "from", "to");

-- CreateIndex
CREATE INDEX "reservations_roomId_from_idx" ON "reservations"("roomId", "from");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written (ADR-0009): no two seat statuses may overlap on the same seat. This is what
-- makes double booking impossible under concurrency; application code only produces the
-- friendly error. Prisma cannot express exclusion constraints, so `prisma migrate dev` will
-- report drift for this constraint; that is expected and documented in docs/adr.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "seat_statuses"
  ADD CONSTRAINT "seat_statuses_no_overlap"
  EXCLUDE USING gist ("seatId" WITH =, tsrange("from", "to", '[)') WITH &&);
