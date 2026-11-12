import type { SeatDto } from "@campus/contracts";
import { Button } from "antd";
import { describeAvailability, groupSeatsByState, seatState } from "./seat-map.model";

interface SeatListProps {
  seats: ReadonlyArray<SeatDto>;
  timeZone: string;
  selectedSeatId: string | null;
  onSelectSeat: (seat: SeatDto) => void;
}

/**
 * The floor plan as text (REQ-M1-11 list mode): the same seats grouped by state, free first.
 * It is the accessible and small-screen alternative to the map, not a different data set.
 */
export function SeatList({ seats, timeZone, selectedSeatId, onSelectSeat }: SeatListProps) {
  const groups = groupSeatsByState(seats);
  return (
    <div className="seat-list" data-testid="seat-list">
      {groups.map((group) => (
        <section key={group.state} className="seat-list__group" data-state={group.state}>
          <h2 className="seat-list__title">
            {group.label} <small>{group.seats.length}</small>
          </h2>
          <ul className="seat-list__items">
            {group.seats.map((seat) => {
              const state = seatState(seat);
              const action = state === "FREE" ? "预约" : state === "MINE" ? "取消" : null;
              return (
                <li
                  key={seat.id}
                  className="seat-list__item"
                  data-seat-code={seat.code}
                  data-state={state}
                  data-selected={seat.id === selectedSeatId}
                >
                  <span className="seat-list__code">{seat.code}</span>
                  <span className="seat-list__meta">
                    {seat.hasPowerOutlet ? "⚡ 靠近插座 · " : ""}
                    {describeAvailability(seat, timeZone)}
                  </span>
                  {action ? (
                    <Button
                      size="small"
                      type={state === "FREE" ? "primary" : "default"}
                      danger={state === "MINE"}
                      onClick={() => onSelectSeat(seat)}
                      aria-label={`${action}座位 ${seat.code}`}
                    >
                      {action}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
