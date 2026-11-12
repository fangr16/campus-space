import "./seat-map.css";
import type { PowerOutletDto, RoomDto, SeatDto } from "@campus/contracts";
import {
  describeOutlet,
  describeSeat,
  gridLines,
  isSelectable,
  minMapWidthPx,
  roomViewBox,
  SEAT_SIZE,
  seatActionLabel,
  seatState,
} from "./seat-map.model";

interface SeatMapProps {
  room: RoomDto;
  seats: ReadonlyArray<SeatDto>;
  outlets: ReadonlyArray<PowerOutletDto>;
  timeZone: string;
  /** Highlighted seat, e.g. the one in the selection card. */
  selectedSeatId?: string | null;
  /** When given, free and own seats become buttons (click or Enter/Space). */
  onSelectSeat?: (seat: SeatDto) => void;
  /** 1 fits the container; larger values scroll inside the viewport. */
  zoom?: number;
}

/**
 * Floor plan of one room (REQ-M1-10) coloured by availability in the chosen window
 * (REQ-M1-11). Geometry is in grid units inside an SVG viewBox; the SVG never gets narrower
 * than `minMapWidthPx`, so on a phone the viewport scrolls instead of shrinking seats below
 * a touch target. Occupied seats are not buttons; their <title> explains who holds them.
 */
export function SeatMap({
  room,
  seats,
  outlets,
  timeZone,
  selectedSeatId,
  onSelectSeat,
  zoom = 1,
}: SeatMapProps) {
  const lines = gridLines(room);
  return (
    <figure className="seat-map">
      <div className="seat-map__viewport" data-testid="seat-map-viewport">
        <svg
          className="seat-map__svg"
          viewBox={roomViewBox(room)}
          style={{
            width: `${zoom * 100}%`,
            minWidth: minMapWidthPx(room),
            // At zoom 1 the whole plan fits the viewport height; zooming lets it scroll.
            maxHeight: zoom === 1 ? "min(70vh, 640px)" : undefined,
          }}
          role="img"
          aria-label={`${room.name} 座位平面图：${seats.length} 个座位，${outlets.length} 个插座`}
        >
          <rect className="seat-map__floor" x={0} y={0} width={room.width} height={room.height} />
          <g className="seat-map__grid">
            {lines.vertical.map((x) => (
              <line key={`v${x}`} x1={x} y1={0} x2={x} y2={room.height} />
            ))}
            {lines.horizontal.map((y) => (
              <line key={`h${y}`} x1={0} y1={y} x2={room.width} y2={y} />
            ))}
          </g>

          <g className="seat-map__ranges">
            {outlets.map((outlet) => (
              <circle
                key={outlet.id}
                cx={outlet.x}
                cy={outlet.y}
                r={outlet.range}
                data-outlet-range={outlet.code}
              />
            ))}
          </g>

          <g className="seat-map__seats">
            {seats.map((seat) => {
              const interactive = onSelectSeat !== undefined && isSelectable(seat);
              return (
                // biome-ignore lint/a11y/noStaticElementInteractions: role="button" and tabIndex are set in the same condition as the handlers.
                <g
                  key={seat.id}
                  className="seat-map__seat"
                  data-seat-code={seat.code}
                  data-power={seat.hasPowerOutlet}
                  data-state={seatState(seat)}
                  data-selected={seat.id === selectedSeatId}
                  transform={`translate(${seat.x - SEAT_SIZE / 2} ${seat.y - SEAT_SIZE / 2})`}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  aria-label={interactive ? seatActionLabel(seat) : undefined}
                  aria-disabled={onSelectSeat !== undefined && !interactive ? true : undefined}
                  onClick={interactive ? () => onSelectSeat(seat) : undefined}
                  onKeyDown={
                    interactive
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectSeat(seat);
                          }
                        }
                      : undefined
                  }
                >
                  <title>{describeSeat(seat, timeZone)}</title>
                  <rect width={SEAT_SIZE} height={SEAT_SIZE} rx={0.18} />
                  <text x={SEAT_SIZE / 2} y={SEAT_SIZE / 2}>
                    {seat.code}
                  </text>
                </g>
              );
            })}
          </g>

          <g className="seat-map__outlets">
            {outlets.map((outlet) => (
              <g
                key={outlet.id}
                className="seat-map__outlet"
                data-outlet-code={outlet.code}
                data-outlet-kind={outlet.kind}
              >
                <title>{describeOutlet(outlet)}</title>
                <circle cx={outlet.x} cy={outlet.y} r={0.45} />
                <text x={outlet.x} y={outlet.y}>
                  ⚡
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <figcaption className="seat-map__legend">
        <span>
          <i className="seat-map__swatch" data-kind="free" /> 空闲
        </span>
        <span>
          <i className="seat-map__swatch" data-kind="mine" /> 我的预约
        </span>
        <span>
          <i className="seat-map__swatch" data-kind="reserved" /> 已被预约
        </span>
        <span>
          <i className="seat-map__swatch" data-kind="blocked" /> 不可用（教室预约 / 维修）
        </span>
        <span>
          <i className="seat-map__swatch" data-kind="powered" /> 插座覆盖范围内
        </span>
        <span>
          <i className="seat-map__swatch" data-kind="outlet" /> 插座及范围
        </span>
      </figcaption>
    </figure>
  );
}
