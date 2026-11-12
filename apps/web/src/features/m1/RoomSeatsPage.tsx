import type { SeatDto } from "@campus/contracts";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App as AntApp, Button, Segmented } from "antd";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiClientError } from "../../lib/api-client";
import { cancelReservation, createReservation, fetchMyReservations, fetchRoomSeats } from "./api";
import { describeRule } from "./reservation.model";
import { SeatList } from "./SeatList";
import { SeatMap } from "./SeatMap";
import { SelectionCard } from "./SelectionCard";
import { hasPowerParam, type PowerFilter, summarizeSeats } from "./seat-grid.model";
import { isSelectable, seatState, stepZoom } from "./seat-map.model";
import { TimeBar } from "./TimeBar";
import {
  allowedSlots,
  clampToRoom,
  defaultSlots,
  describeWindow,
  findOverlapping,
  sameWindow,
  windowRange,
} from "./time-window.model";
import { useTimeWindow } from "./useTimeWindow";

interface Selection {
  seatId: string;
  slots: number | undefined;
}

function explain(error: unknown, fallback: string): string {
  return error instanceof ApiClientError
    ? describeRule((error.details as { rule?: unknown } | undefined)?.rule, error.message)
    : fallback;
}

/**
 * Time-first reservation (REQ-M1-11): pick a start, see the floor plan (REQ-M1-10) coloured
 * by availability, click a free seat, pick a duration the seat allows and confirm; click your
 * own seat to release it. The power filter (REQ-M1-09) and a list view for small screens sit
 * in the toolbar.
 */
export function RoomSeatsPage() {
  const { id = "" } = useParams();
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const time = useTimeWindow();
  const [filter, setFilter] = useState<PowerFilter>("all");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [zoom, setZoom] = useState(1);

  const result = useQuery({
    queryKey: ["m1", "room-seats", id, filter, time.horizon],
    queryFn: () => fetchRoomSeats(id, { hasPower: hasPowerParam(filter), ...time.horizon }),
    enabled: id.length > 0,
    // Changing the start keeps the current plan on screen (and focus in the time bar) while
    // the new availability loads; the stale plan is only dimmed.
    placeholderData: keepPreviousData,
  });
  const mine = useQuery({ queryKey: ["m1", "reservations", "me"], queryFn: fetchMyReservations });

  // A start from the URL or the room list may fall outside this room's hours; snap it.
  const room = result.data?.room;
  useEffect(() => {
    if (!room) return;
    const clamped = clampToRoom(time.window, room, time.settings, time.now);
    if (!sameWindow(clamped, time.window)) time.setWindow(clamped);
  }, [room, time.window, time.settings, time.now, time.setWindow]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["m1"] });
  const reserve = useMutation({
    mutationFn: ({ seat, slots }: { seat: SeatDto; slots: number }) =>
      createReservation({ seatId: seat.id, ...windowRange(time.window, time.settings, slots) }),
    onSuccess: (dto) => {
      message.success(`${dto.roomName} ${dto.seatCode} 号座已预约`);
      setSelection(null);
      refresh();
    },
  });
  const release = useMutation({
    mutationFn: (seat: SeatDto) => {
      const refId = seat.availability?.refId;
      if (!refId) throw new Error("这不是你的预约");
      return cancelReservation(refId);
    },
    onSuccess: (dto) => {
      message.success(`${dto.roomName} ${dto.seatCode} 号座的预约已取消`);
      setSelection(null);
      refresh();
    },
  });

  if (result.isPending) return <p className="state">正在加载座位…</p>;
  if (result.isError) {
    return (
      <p className="state" data-kind="error" role="alert">
        无法打开这间自习室：{result.error.message} <Link to="/m1/rooms">返回列表</Link>
      </p>
    );
  }

  const { seats, outlets } = result.data;
  const summary = summarizeSeats(seats, filter);
  const free = seats.filter((s) => seatState(s) === "FREE").length;
  // A seat selected as free may have become taken after a start change or a refetch.
  const selectedSeat = seats.find((s) => s.id === selection?.seatId);
  const selected = selectedSeat && isSelectable(selectedSeat) ? selectedSeat : null;
  const allowed = selected
    ? allowedSlots(time.window, result.data.room, time.settings, selected.availability?.freeUntil)
    : [];
  const slots =
    selection?.slots !== undefined && allowed.includes(selection.slots)
      ? selection.slots
      : undefined;
  const held = findOverlapping(mine.data ?? [], time.slotRange);
  const error = reserve.error
    ? explain(reserve.error, "预约失败，请稍后再试")
    : release.error
      ? explain(release.error, "取消失败，请稍后再试")
      : null;

  const select = (seat: SeatDto) => {
    reserve.reset();
    release.reset();
    const options = allowedSlots(
      time.window,
      result.data.room,
      time.settings,
      seat.availability?.freeUntil,
    );
    setSelection({ seatId: seat.id, slots: defaultSlots(options) });
  };
  const hoursLabel = (n: number) => `${(n * time.settings.slotMinutes) / 60} 小时`;

  return (
    <section aria-labelledby="seats-title" className="seats-page">
      <header className="page__head">
        <div>
          <p className="page__eyebrow">
            <Link to="/m1/rooms">自习室</Link> / {result.data.room.code} ·{" "}
            <Link to="/m1/reservations">我的预约</Link>
          </p>
          <h1 id="seats-title" className="page__title">
            {result.data.room.name}
          </h1>
          <p className="page__lede">
            {result.data.room.building} {result.data.room.floor} 层 · 开放{" "}
            {result.data.room.openFrom}–{result.data.room.openTo} · 共 {result.data.room.seatCount}{" "}
            座 · 每次最多 {time.settings.maxHours} 小时
          </p>
        </div>
      </header>

      <TimeBar
        window={time.window}
        onChange={time.setWindow}
        settings={time.settings}
        now={time.now}
        room={result.data.room}
      />

      {held ? (
        <p className="seats-page__held" role="status" data-testid="held-banner">
          {held.roomId === id
            ? `这个时间你已预约本室 ${held.seatCode} 号座，点击它可以取消。`
            : `这个时间你已在 ${held.roomName} 预约 ${held.seatCode} 号座，一人一时段只能持有一个座位。`}{" "}
          <Link to="/m1/reservations">查看我的预约</Link>
        </p>
      ) : null}

      <div className="seats-toolbar">
        <p className="seat-legend" data-testid="seat-summary">
          <span>
            {describeWindow(time.window, time.settings)}空闲 {free} / {summary.shown}
          </span>
          <span>显示 {summary.shown} 个</span>
          <span>⚡ 覆盖范围内 {summary.powered} 个</span>
        </p>
        <div className="seats-toolbar__controls">
          <Segmented<PowerFilter>
            value={filter}
            onChange={setFilter}
            options={[
              { label: "全部座位", value: "all" },
              { label: "靠近插座", value: "power" },
            ]}
            aria-label="座位筛选"
          />
          <Segmented<"map" | "list">
            value={time.view}
            onChange={time.setView}
            options={[
              { label: "平面图", value: "map" },
              { label: "列表", value: "list" },
            ]}
            aria-label="视图"
          />
          {time.view === "map" ? (
            <span className="seats-toolbar__zoom">
              <Button size="small" onClick={() => setZoom(stepZoom(zoom, -1))} aria-label="缩小">
                −
              </Button>
              <Button size="small" onClick={() => setZoom(stepZoom(zoom, 1))} aria-label="放大">
                +
              </Button>
              <Button size="small" onClick={() => setZoom(1)} disabled={zoom === 1}>
                适应
              </Button>
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="seats-layout"
        data-selected={selected !== null}
        data-loading={result.isPlaceholderData}
      >
        {seats.length === 0 ? (
          <p className="state">没有符合条件的座位。</p>
        ) : time.view === "list" ? (
          <SeatList
            seats={seats}
            timeZone={time.settings.timezone}
            selectedSeatId={selected?.id ?? null}
            onSelectSeat={select}
          />
        ) : (
          <SeatMap
            room={result.data.room}
            seats={seats}
            outlets={outlets}
            timeZone={time.settings.timezone}
            selectedSeatId={selected?.id ?? null}
            onSelectSeat={select}
            zoom={zoom}
          />
        )}
        {selected ? (
          <SelectionCard
            room={result.data.room}
            seat={selected}
            timeZone={time.settings.timezone}
            startLabel={describeWindow(time.window, time.settings)}
            endLabel={
              slots === undefined ? null : describeWindow(time.window, time.settings, slots)
            }
            allowedSlots={allowed}
            slots={slots}
            onSlotsChange={(next) => setSelection({ seatId: selected.id, slots: next })}
            slotsLabel={hoursLabel}
            pending={reserve.isPending || release.isPending}
            error={error}
            onReserve={() => {
              if (slots !== undefined) reserve.mutate({ seat: selected, slots });
            }}
            onCancelReservation={() => release.mutate(selected)}
            onClose={() => setSelection(null)}
          />
        ) : null}
      </div>
    </section>
  );
}
