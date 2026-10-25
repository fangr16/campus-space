/**
 * Idempotent seed for the m1 schema: demo rooms and seats (master data only, D-2).
 * Reservations and seat statuses are business data and are never seeded.
 */
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

interface RoomSeed {
  code: string;
  name: string;
  building: string;
  floor: number;
  openFrom: string;
  openTo: string;
  departmentId: string | null;
  seatCount: number;
  /** Every n-th seat is near a power outlet (REQ-M1-09). */
  powerEvery: number;
}

const ROOMS: ReadonlyArray<RoomSeed> = [
  {
    code: "LIB-301",
    name: "图书馆三楼自习室",
    building: "图书馆",
    floor: 3,
    openFrom: "07:00",
    openTo: "22:30",
    departmentId: null,
    seatCount: 40,
    powerEvery: 4,
  },
  {
    code: "LIB-402",
    name: "图书馆四楼静音区",
    building: "图书馆",
    floor: 4,
    openFrom: "08:00",
    openTo: "22:00",
    departmentId: null,
    seatCount: 24,
    powerEvery: 2,
  },
  {
    code: "CS-304",
    name: "计算机学院 304 自习室",
    building: "逸夫楼",
    floor: 3,
    openFrom: "08:00",
    openTo: "21:30",
    departmentId: "CS",
    seatCount: 20,
    powerEvery: 1,
  },
];

async function main(): Promise<void> {
  let seats = 0;
  for (const spec of ROOMS) {
    const { seatCount, powerEvery, ...room } = spec;
    const saved = await prisma.room.upsert({
      where: { code: room.code },
      update: room,
      create: room,
    });
    for (let i = 1; i <= seatCount; i += 1) {
      const code = String(i).padStart(2, "0");
      await prisma.seat.upsert({
        where: { roomId_code: { roomId: saved.id, code } },
        update: { hasPowerOutlet: i % powerEvery === 0 },
        create: { roomId: saved.id, code, hasPowerOutlet: i % powerEvery === 0 },
      });
      seats += 1;
    }
  }
  console.info(`seed: ${ROOMS.length} rooms, ${seats} seats`);
}

main()
  .catch((error: unknown) => {
    console.error("seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
