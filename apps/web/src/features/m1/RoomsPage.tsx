import type { RoomQuery } from "@campus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Input } from "antd";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { fetchRooms } from "./api";
import { TimeBar } from "./TimeBar";
import { describeWindow } from "./time-window.model";
import { useTimeWindow } from "./useTimeWindow";

/**
 * REQ-M1-07: search rooms; visibility (REQ-M1-02) is enforced by the API. Rooms report how
 * many seats are free in the chosen window (REQ-M1-11), and the window travels in the URL
 * into the floor plan.
 */
export function RoomsPage() {
  const [query, setQuery] = useState<RoomQuery>({});
  const time = useTimeWindow();
  const location = useLocation();
  const rooms = useQuery({
    queryKey: ["m1", "rooms", query, time.slotRange],
    queryFn: () => fetchRooms({ ...query, ...time.slotRange }),
  });

  return (
    <section aria-labelledby="rooms-title">
      <header className="page__head">
        <div>
          <p className="page__eyebrow">M1 · 自习座位预约</p>
          <h1 id="rooms-title" className="page__title">
            自习室
          </h1>
          <p className="page__lede">
            先选开始时间，再挑一间有空位的自习室。只显示你有权使用的自习室。{" "}
            <Link to="/m1/reservations">查看我的预约</Link>
          </p>
        </div>
        <Input.Search
          allowClear
          placeholder="按名称或编号搜索"
          className="rooms-search"
          onSearch={(value) => setQuery(value.trim() ? { keyword: value.trim() } : {})}
          aria-label="搜索自习室"
        />
      </header>

      <TimeBar
        window={time.window}
        onChange={time.setWindow}
        settings={time.settings}
        now={time.now}
      />

      {rooms.isPending ? <p className="state">正在加载自习室…</p> : null}
      {rooms.isError ? (
        <p className="state" data-kind="error" role="alert">
          加载失败：{rooms.error.message}
        </p>
      ) : null}
      {rooms.data && rooms.data.length === 0 ? <p className="state">没有匹配的自习室。</p> : null}
      {rooms.data && rooms.data.length > 0 ? (
        <ul className="room-list">
          {rooms.data.map((room) => (
            <li key={room.id}>
              <Link
                to={{ pathname: `/m1/rooms/${room.id}`, search: location.search }}
                className="room-card"
                data-room-code={room.code}
                data-free={room.freeSeatCount}
              >
                <span className="room-card__code">{room.code}</span>
                <h2 className="room-card__name">{room.name}</h2>
                <span className="room-card__free" data-empty={room.freeSeatCount === 0}>
                  {describeWindow(time.window, time.settings)}空闲{" "}
                  <strong>{room.freeSeatCount ?? "–"}</strong> / {room.seatCount}
                </span>
                <span className="room-card__meta">
                  <span>
                    {room.building} · {room.floor} 层 · {room.openFrom}–{room.openTo}
                  </span>
                  <span className="room-card__dept">
                    {room.departmentId ? `${room.departmentId} 院系专用` : "全校开放"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
