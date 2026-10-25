/**
 * Idempotent seed for the platform schema: roles, permissions and demo accounts.
 * Safe to run on every deploy (`pnpm db:seed`); upserts never duplicate rows.
 * Business data (reservations, tickets) is never seeded here.
 */
import { Role } from "@campus/contracts";
import { hash } from "bcryptjs";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

const ROLES: ReadonlyArray<{ code: Role; name: string; description: string }> = [
  { code: Role.STUDENT, name: "学生", description: "预约座位、申请整教室、上报故障" },
  { code: Role.ROOM_MANAGER, name: "教室管理员", description: "管理自习室与座位" },
  { code: Role.OPS_MANAGER, name: "运营管理员", description: "查看统计与预约情况" },
  { code: Role.APPROVER, name: "审批人", description: "审批整教室申请" },
  { code: Role.MAINTAINER, name: "维修人员", description: "处理报修工单" },
  { code: Role.ADMIN, name: "系统管理员", description: "管理配置、角色与权限" },
];

const PERMISSIONS: ReadonlyArray<{ code: string; description: string; roles: Role[] }> = [
  {
    code: "m1.room.manage",
    description: "登记、注销自习室与座位",
    roles: [Role.ROOM_MANAGER, Role.ADMIN],
  },
  { code: "m1.stats.read", description: "查看预约统计", roles: [Role.OPS_MANAGER, Role.ADMIN] },
  { code: "m2.booking.approve", description: "审批整教室申请", roles: [Role.APPROVER, Role.ADMIN] },
  {
    code: "m3.ticket.dispatch",
    description: "派单与维修状态流转",
    roles: [Role.MAINTAINER, Role.ADMIN],
  },
  { code: "platform.role.manage", description: "管理角色与权限", roles: [Role.ADMIN] },
];

/** Demo accounts for local and test environments. Production seeds only roles and permissions. */
const DEMO_USERS: ReadonlyArray<{
  username: string;
  displayName: string;
  roles: Role[];
  departmentId: string | null;
}> = [
  { username: "admin", displayName: "系统管理员", roles: [Role.ADMIN], departmentId: null },
  { username: "student", displayName: "张同学", roles: [Role.STUDENT], departmentId: "CS" },
  {
    username: "manager",
    displayName: "李老师",
    roles: [Role.ROOM_MANAGER, Role.APPROVER],
    departmentId: "CS",
  },
  { username: "maintainer", displayName: "王师傅", roles: [Role.MAINTAINER], departmentId: null },
];

async function main(): Promise<void> {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }

  for (const permission of PERMISSIONS) {
    const saved = await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: { code: permission.code, description: permission.description },
    });
    for (const roleCode of permission.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: saved.id } },
        update: {},
        create: { roleId: role.id, permissionId: saved.id },
      });
    }
  }

  // Demo accounts are opt-in. Production additionally needs an explicit password so the
  // well-known development password can never end up on a public host.
  if (process.env.SEED_DEMO_USERS !== "true") {
    console.info("seed: demo users skipped (set SEED_DEMO_USERS=true to create them)");
    return;
  }
  const password = process.env.SEED_DEMO_PASSWORD?.trim() || undefined;
  if (process.env.NODE_ENV === "production" && !password) {
    throw new Error("SEED_DEMO_USERS=true in production requires SEED_DEMO_PASSWORD");
  }
  const effectivePassword = password ?? "Campus@2026";
  const passwordHash = await hash(effectivePassword, 10);
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { username: demo.username },
      update: { displayName: demo.displayName, departmentId: demo.departmentId },
      create: {
        username: demo.username,
        displayName: demo.displayName,
        departmentId: demo.departmentId,
        passwordHash,
      },
    });
    for (const roleCode of demo.roles) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
  }
  console.info(
    `seed: ${ROLES.length} roles, ${PERMISSIONS.length} permissions, ${DEMO_USERS.length} demo users`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("seed failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
