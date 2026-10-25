import { useQuery } from "@tanstack/react-query";
import { Segmented } from "antd";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { fetchRoomSeats } from "./api";
import { SeatMap } from "./SeatMap";
import { hasPowerParam, type PowerFilter, summarizeSeats } from "./seat-grid.model";

/**
 * REQ-M1-10 floor plan of one room with REQ-M1-09 power filter. Reservation comes in
 * REQ-M1-04. The filter is applied by the API, so a filtered map only draws the matching
 * seats while every outlet stays visible.
 */
export function RoomSeatsPage() {
  const { id = "" } = useParams();
  const [filter, setFilter] = useState<PowerFilter>("all");
  const result = useQuery({
    queryKey: ["m1", "room-seats", id, filter],
    queryFn: () => fetchRoomSeats(id, hasPowerParam(filter)),
    enabled: id.length > 0,
  });

  if (result.isPending) return <p className="state">正在加载座位…</p>;
  if (result.isError) {
    return (
      <p className="state" data-kind="error" role="alert">
        无法打开这间自习室：{result.error.message} <Link to="/m1/rooms">返回列表</Link>
      </p>
    );
  }

  const { room, seats, outlets } = result.data;
  const summary = summarizeSeats(seats, filter);

  return (
    <section aria-labelledby="seats-title">
      <header className="page__head">
        <div>
          <p className="page__eyebrow">
            <Link to="/m1/rooms">自习室</Link> / {room.code}
          </p>
          <h1 id="seats-title" className="page__title">
            {room.name}
          </h1>
          <p className="page__lede">
            {room.building} {room.floor} 层 · 开放 {room.openFrom}–{room.openTo} ·{" "}
            {room.departmentId ? `${room.departmentId} 院系专用` : "全校开放"} · 共 {room.seatCount}{" "}
            座 · {outlets.length} 个插座
          </p>
        </div>
        <Segmented<PowerFilter>
          value={filter}
          onChange={setFilter}
          options={[
            { label: "全部座位", value: "all" },
            { label: "靠近插座", value: "power" },
          ]}
          aria-label="座位筛选"
        />
      </header>

      <p className="seat-legend" data-testid="seat-summary">
        <span>显示 {summary.shown} 个</span>
        <span>⚡ 覆盖范围内 {summary.powered} 个</span>
      </p>

      {seats.length === 0 ? (
        <p className="state">没有符合条件的座位。</p>
      ) : (
        <SeatMap room={room} seats={seats} outlets={outlets} />
      )}
    </section>
  );
}
