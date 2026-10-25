import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Shape the rest of the service works with; never the raw Prisma row. */
export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  departmentId: string | null;
  isActive: boolean;
  roleCodes: string[];
}

/** Data access for users and their role codes. The only place that touches Prisma for users. */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { username },
      include: { roles: { include: { role: { select: { code: true } } } } },
    });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: { select: { code: true } } } } },
    });
    return row ? toRecord(row) : null;
  }
}

interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  departmentId: string | null;
  isActive: boolean;
  roles: Array<{ role: { code: string } }>;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    departmentId: row.departmentId,
    isActive: row.isActive,
    roleCodes: row.roles.map((r) => r.role.code),
  };
}
