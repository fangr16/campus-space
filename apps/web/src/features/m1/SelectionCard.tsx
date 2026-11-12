import type { RoomDto, SeatDto } from "@campus/contracts";
import { Alert, Button, Select } from "antd";
import { describeAvailability, seatState } from "./seat-map.model";

interface SelectionCardProps {
  room: RoomDto;
  seat: SeatDto;
  timeZone: string;
  /** "11/06 10:00 起" for the heading; the chosen duration completes it. */
  startLabel: string;
  endLabel: string | null;
  /** Durations (in slots) this seat allows from the start; empty means it cannot be booked. */
  allowedSlots: ReadonlyArray<number>;
  slots: number | undefined;
  onSlotsChange: (slots: number) => void;
  slotsLabel: (slots: number) => string;
  pending: boolean;
  error: string | null;
  onReserve: () => void;
  onCancelReservation: () => void;
  onClose: () => void;
}

/**
 * Confirmation beside the map (REQ-M1-11): the chosen seat and start, a duration limited to
 * what the seat and room allow, and one action. A free seat offers "确认预约"; the caller's own
 * seat offers "取消预约". On phones the card sits at the bottom of the screen (seat-map.css).
 */
export function SelectionCard({
  room,
  seat,
  timeZone,
  startLabel,
  endLabel,
  allowedSlots,
  slots,
  onSlotsChange,
  slotsLabel,
  pending,
  error,
  onReserve,
  onCancelReservation,
  onClose,
}: SelectionCardProps) {
  const mine = seatState(seat) === "MINE";
  return (
    <aside className="selection-card" aria-label="已选座位" data-testid="selection-card">
      <header className="selection-card__head">
        <span className="selection-card__seat">{seat.code}</span>
        <span className="selection-card__room">
          {room.name}
          <small>{endLabel ?? startLabel}</small>
        </span>
        <Button type="text" size="small" onClick={onClose} aria-label="取消选择">
          ✕
        </Button>
      </header>
      <p className="selection-card__meta">
        {seat.hasPowerOutlet ? "⚡ 靠近插座" : "不在插座覆盖范围内"} ·{" "}
        {describeAvailability(seat, timeZone)}
      </p>
      {mine ? null : allowedSlots.length === 0 ? (
        <p className="selection-card__meta">这个座位从所选时间起已没有完整的时段可约。</p>
      ) : (
        <div className="time-bar__field">
          <span aria-hidden="true">时长</span>
          <Select<number>
            value={slots}
            onChange={onSlotsChange}
            options={allowedSlots.map((n) => ({ value: n, label: slotsLabel(n) }))}
            aria-label="时长"
            popupMatchSelectWidth={false}
            style={{ flex: 1 }}
          />
        </div>
      )}
      {error ? <Alert type="error" showIcon title={error} role="alert" /> : null}
      {mine ? (
        <Button danger block loading={pending} onClick={onCancelReservation}>
          取消预约
        </Button>
      ) : (
        <Button
          type="primary"
          block
          loading={pending}
          disabled={slots === undefined}
          onClick={onReserve}
        >
          确认预约
        </Button>
      )}
    </aside>
  );
}
