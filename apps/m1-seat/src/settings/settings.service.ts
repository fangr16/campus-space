import { type SettingDto, SettingKey } from "@campus/contracts";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReservationSettings } from "../reservations/reservation-rules";

/** Defaults used until an administrator stores a value (REQ-M1-04: 4 hours, whole hours). */
export const SETTING_DEFAULTS: Readonly<Record<SettingKey, string>> = {
  [SettingKey.RESERVATION_MAX_HOURS]: "4",
  [SettingKey.RESERVATION_SLOT_MINUTES]: "60",
  [SettingKey.ROOM_TIMEZONE]: "Asia/Shanghai",
};

const KNOWN_KEYS = new Set<string>(Object.values(SettingKey));

/** Returns a human-readable reason when a value is not acceptable for the key, else null. */
export function validateSetting(key: string, value: string): string | null {
  if (!KNOWN_KEYS.has(key)) return `unknown setting ${key}`;
  switch (key) {
    case SettingKey.RESERVATION_MAX_HOURS: {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 12
        ? null
        : "maxHours must be an integer from 1 to 12";
    }
    case SettingKey.RESERVATION_SLOT_MINUTES:
      return value === "30" || value === "60" ? null : "slotMinutes must be 30 or 60";
    case SettingKey.ROOM_TIMEZONE:
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return null;
      } catch {
        return "timezone must be a valid IANA zone such as Asia/Shanghai";
      }
    default:
      return null;
  }
}

/** Builds typed reservation settings from stored rows, falling back to the defaults. */
export function parseReservationSettings(
  rows: ReadonlyArray<{ key: string; value: string }>,
): ReservationSettings {
  const get = (key: SettingKey) => rows.find((r) => r.key === key)?.value ?? SETTING_DEFAULTS[key];
  return {
    maxHours: Number(get(SettingKey.RESERVATION_MAX_HOURS)),
    slotMinutes: Number(get(SettingKey.RESERVATION_SLOT_MINUTES)),
    timezone: get(SettingKey.ROOM_TIMEZONE),
  };
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<SettingDto[]> {
    const rows = await this.prisma.setting.findMany({ orderBy: { key: "asc" } });
    const stored = new Map(rows.map((r) => [r.key, r]));
    return Object.values(SettingKey).map((key) => {
      const row = stored.get(key);
      return {
        key,
        value: row?.value ?? SETTING_DEFAULTS[key],
        updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
      };
    });
  }

  async getReservationSettings(): Promise<ReservationSettings> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: Object.values(SettingKey) } },
    });
    return parseReservationSettings(rows);
  }

  /** Throws NotFound for unknown keys and a 400 (via ZodError-like details) for bad values. */
  async update(key: string, value: string): Promise<SettingDto> {
    if (!KNOWN_KEYS.has(key)) throw new NotFoundException(`unknown setting ${key}`);
    const reason = validateSetting(key, value);
    if (reason) throw new InvalidSettingError(key, reason);
    const row = await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return { key: row.key, value: row.value, updatedAt: row.updatedAt.toISOString() };
  }
}

/** Raised for a known key with an unacceptable value; the controller maps it to 400. */
export class InvalidSettingError extends Error {
  constructor(
    readonly key: string,
    readonly reason: string,
  ) {
    super(`${key}: ${reason}`);
    this.name = "InvalidSettingError";
  }
}
