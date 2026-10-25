import type { RoomQuery } from "@campus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Input } from "antd";
import { useState } from "react";
import { Link } from "react-router";
import { fetchRooms } from "./api";

/** REQ-M1-07: search rooms; visibility (REQ-M1-02) is enforced by the API. */
export function RoomsPage() {
  const [query, setQuery] = useState<RoomQuery>({});
  const rooms = useQuery({ queryKey: ["m1", "rooms", query], queryFn: () => fetchRooms(query) });

  return (
    <section aria-labelledby="rooms-title">
      <header className="page__head">
        <div>
          <p className="page__eyebrow">M1 · 自习座位预约</p>
          <h1 id="rooms-title" className="page__title">
            自习室
          </h1>
          <p className="page__lede">只显示你有权使用的自习室：全校开放的，以及本院系的。</p>
        </div>
        <Input.Search
          allowClear
          placeholder="按名称或编号搜索"
          style={{ width: 280 }}
          onSearch={(value) => setQuery(value.trim() ? { keyword: value.trim() } : {})}
          aria-label="搜索自习室"
        />
      </header>

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
              <Link to={`/m1/rooms/${room.id}`} className="room-card" data-room-code={room.code}>
                <span className="room-card__code">{room.code}</span>
                <h2 className="room-card__name">{room.name}</h2>
                <span className="room-card__meta">
                  <span>
                    {room.building} · {room.floor} 层
                  </span>
                  <span>
                    {room.openFrom}–{room.openTo}
                  </span>
                </span>
                <span className="room-card__meta">
                  <span>{room.seatCount} 个座位</span>
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
