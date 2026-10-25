import "./seat-map.css";
import type { PowerOutletDto, RoomDto, SeatDto } from "@campus/contracts";
import {
  describeOutlet,
  describeSeat,
  gridLines,
  MAP_MAX_HEIGHT_PX,
  roomViewBox,
  SEAT_SIZE,
} from "./seat-map.model";

interface SeatMapProps {
  room: RoomDto;
  seats: ReadonlyArray<SeatDto>;
  outlets: ReadonlyArray<PowerOutletDto>;
}

/**
 * Floor plan of one room (REQ-M1-10). Everything is drawn in grid units inside an SVG
 * viewBox, so the plan scales with the container; each outlet shows its reach as a ring and
 * seats inside any ring are highlighted. The highlight comes from the API's derived
 * hasPowerOutlet flag; the rings are purely visual. Grid lines and rings carry no text, so
 * assistive technology only announces the seats and outlets through their <title>.
 */
export function SeatMap({ room, seats, outlets }: SeatMapProps) {
  const lines = gridLines(room);
  return (
    <figure className="seat-map">
      <svg
        className="seat-map__svg"
        viewBox={roomViewBox(room)}
        style={{ maxHeight: MAP_MAX_HEIGHT_PX }}
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
          {seats.map((seat) => (
            <g
              key={seat.id}
              className="seat-map__seat"
              data-seat-code={seat.code}
              data-power={seat.hasPowerOutlet}
              transform={`translate(${seat.x - SEAT_SIZE / 2} ${seat.y - SEAT_SIZE / 2})`}
            >
              <title>{describeSeat(seat)}</title>
              <rect width={SEAT_SIZE} height={SEAT_SIZE} rx={0.18} />
              <text x={SEAT_SIZE / 2} y={SEAT_SIZE / 2}>
                {seat.code}
              </text>
            </g>
          ))}
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
      <figcaption className="seat-map__legend">
        <span>
          <i className="seat-map__swatch" data-kind="seat" /> 座位
        </span>
        <span>
          <i className="seat-map__swatch" data-kind="powered" /> 覆盖范围内的座位
        </span>
        <span>
          <i className="seat-map__swatch" data-kind="outlet" /> 插座及可用范围
        </span>
        <span>网格单位为抽象坐标，一格约一张桌子</span>
      </figcaption>
    </figure>
  );
}
