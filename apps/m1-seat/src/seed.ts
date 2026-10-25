/**
 * Idempotent seed for the m1 schema: demo rooms, seats on a floor plan and power outlets
 * (master data only, D-2). Reservations and seat statuses are business data, never seeded.
 *
 * Layout convention (REQ-M1-10): abstract grid, (0,0) top-left, seats on even coordinates two
 * units apart, outlets on the walls (FIXED, range 1) or in the middle of the room (RAIL,
 * larger range). Which seats count as powered is derived from the outlets at read time.
 */
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

interface OutletSeed {
  code: string;
  kind: "FIXED" | "RAIL";
  x: number;
  y: number;
  range: number;
}

interface RoomSeed {
  code: string;
  name: string;
  building: string;
  floor: number;
  openFrom: string;
  openTo: string;
  departmentId: string | null;
  width: number;
  height: number;
  columns: number;
  rows: number;
  outlets: OutletSeed[];
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
    width: 18,
    height: 12,
    columns: 8,
    rows: 5,
    // Two wall sockets reach one desk each; the central rail reaches the eight desks around it.
    outlets: [
      { code: "W1", kind: "FIXED", x: 1, y: 2, range: 1 },
      { code: "W2", kind: "FIXED", x: 1, y: 10, range: 1 },
      { code: "R1", kind: "RAIL", x: 9, y: 6, range: 3 },
    ],
  },
  {
    code: "LIB-402",
    name: "图书馆四楼静音区",
    building: "图书馆",
    floor: 4,
    openFrom: "08:00",
    openTo: "22:00",
    departmentId: null,
    width: 14,
    height: 10,
    columns: 6,
    rows: 4,
    outlets: [{ code: "R1", kind: "RAIL", x: 7, y: 5, range: 4 }],
  },
  {
    code: "CS-304",
    name: "计算机学院 304 自习室",
    building: "逸夫楼",
    floor: 3,
    openFrom: "08:00",
    openTo: "21:30",
    departmentId: "CS",
    width: 12,
    height: 10,
    columns: 5,
    rows: 4,
    // Two desk rails cover the whole room: every seat is powered.
    outlets: [
      { code: "R1", kind: "RAIL", x: 6, y: 3, range: 5 },
      { code: "R2", kind: "RAIL", x: 6, y: 7, range: 5 },
    ],
  },
];

/** Seat n (1-based) of a columns x rows grid: left to right, then next row. */
export function seatPosition(index: number, columns: number): { x: number; y: number } {
  const zeroBased = index - 1;
  return { x: 2 + (zeroBased % columns) * 2, y: 2 + Math.floor(zeroBased / columns) * 2 };
}

async function main(): Promise<void> {
  let seats = 0;
  let outlets = 0;
  for (const spec of ROOMS) {
    const { columns, rows, outlets: outletSeeds, ...room } = spec;
    const saved = await prisma.room.upsert({
      where: { code: room.code },
      update: room,
      create: room,
    });
    for (let i = 1; i <= columns * rows; i += 1) {
      const code = String(i).padStart(2, "0");
      const position = seatPosition(i, columns);
      await prisma.seat.upsert({
        where: { roomId_code: { roomId: saved.id, code } },
        update: position,
        create: { roomId: saved.id, code, ...position },
      });
      seats += 1;
    }
    for (const outlet of outletSeeds) {
      await prisma.powerOutlet.upsert({
        where: { roomId_code: { roomId: saved.id, code: outlet.code } },
        update: { kind: outlet.kind, x: outlet.x, y: outlet.y, range: outlet.range },
        create: { roomId: saved.id, ...outlet },
      });
      outlets += 1;
    }
  }
  console.info(`seed: ${ROOMS.length} rooms, ${seats} seats, ${outlets} power outlets`);
}

main()
  .catch((error: unknown) => {
    console.error("seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
