-- CreateEnum
CREATE TYPE "PowerOutletKind" AS ENUM ('FIXED', 'RAIL');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "height" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "width" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "seats" ADD COLUMN     "x" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "y" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "power_outlets" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PowerOutletKind" NOT NULL DEFAULT 'FIXED',
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "range" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "power_outlets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "power_outlets_roomId_code_key" ON "power_outlets"("roomId", "code");

-- AddForeignKey
ALTER TABLE "power_outlets" ADD CONSTRAINT "power_outlets_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
