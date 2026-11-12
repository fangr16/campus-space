import type { ReservationDto } from "@campus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App as AntApp, Button, Table, Tag } from "antd";
import { useMemo } from "react";
import { Link } from "react-router";
import { ApiClientError } from "../../lib/api-client";
import { cancelReservation, fetchMyReservations, fetchSettings } from "./api";
import { canCancel, describeStart, groupReservations } from "./my-reservations.model";
import { describeRule, formatWindow, parseFormSettings } from "./reservation.model";

const STATUS_LABEL: Record<ReservationDto["status"], { text: string; color: string }> = {
  BOOKED: { text: "已结束", color: "default" },
  CANCELLED: { text: "已取消", color: "default" },
};

/**
 * REQ-M1-04 (cancel) and the list half of REQ-M1-07: what is coming up, as cards with one
 * action each, and a folded history. Re-booking a past seat comes with TASK-013.
 */
export function MyReservationsPage() {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const reservations = useQuery({
    queryKey: ["m1", "reservations", "me"],
    queryFn: fetchMyReservations,
  });
  const settings = useQuery({ queryKey: ["m1", "settings"], queryFn: fetchSettings });
  const timezone = parseFormSettings(settings.data ?? []).timezone;

  const cancel = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: (dto) => {
      message.success(`${dto.roomName} ${dto.seatCode} 号座的预约已取消`);
      queryClient.invalidateQueries({ queryKey: ["m1"] });
    },
    onError: (error: unknown) => {
      message.error(
        error instanceof ApiClientError
          ? describeRule((error.details as { rule?: unknown } | undefined)?.rule, error.message)
          : "取消失败，请稍后再试",
      );
    },
  });

  const groups = groupReservations(reservations.data ?? [], now);

  return (
    <section aria-labelledby="my-reservations-title">
      <header className="page__head">
        <div>
          <p className="page__eyebrow">
            <Link to="/m1/rooms">自习室</Link> / 我的预约
          </p>
          <h1 id="my-reservations-title" className="page__title">
            我的预约
          </h1>
          <p className="page__lede">开始前可以取消；开始后请按时签到，未签到会记一次违约。</p>
        </div>
      </header>

      {reservations.isPending ? <p className="state">正在加载…</p> : null}
      {reservations.isError ? (
        <p className="state" data-kind="error" role="alert">
          加载失败：{reservations.error.message}
        </p>
      ) : null}

      {reservations.data ? (
        <section aria-labelledby="upcoming-title" className="reservations-upcoming">
          <h2 id="upcoming-title" className="reservations__title">
            即将开始 <small>{groups.upcoming.length}</small>
          </h2>
          {groups.upcoming.length === 0 ? (
            <p className="state">
              没有有效预约。去 <Link to="/m1/rooms">自习室</Link> 选个时段挑座位吧。
            </p>
          ) : (
            <ul className="reservation-cards">
              {groups.upcoming.map((r) => (
                <li key={r.id} className="reservation-card" data-testid={`upcoming-${r.seatCode}`}>
                  <span className="reservation-card__seat">{r.seatCode}</span>
                  <span className="reservation-card__body">
                    <strong>{formatWindow(r.from, r.to, timezone)}</strong>
                    <Link to={`/m1/rooms/${r.roomId}`}>
                      {r.roomName}（{r.roomCode}）
                    </Link>
                    <small>{describeStart(r.from, r.to, now)}</small>
                  </span>
                  {canCancel(r, now) ? (
                    <Button
                      danger
                      loading={cancel.isPending && cancel.variables === r.id}
                      onClick={() => cancel.mutate(r.id)}
                      data-testid={`cancel-${r.seatCode}`}
                    >
                      取消预约
                    </Button>
                  ) : (
                    <Tag color="green">进行中</Tag>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {groups.history.length > 0 ? (
        <details className="reservations-history">
          <summary className="reservations__title">
            历史记录 <small>最近 {groups.history.length} 条</small>
          </summary>
          <Table<ReservationDto>
            rowKey="id"
            dataSource={groups.history}
            pagination={false}
            size="small"
            columns={[
              { title: "时段", render: (_, r) => formatWindow(r.from, r.to, timezone) },
              {
                title: "自习室",
                render: (_, r) => (
                  <Link to={`/m1/rooms/${r.roomId}`}>
                    {r.roomName}（{r.roomCode}）
                  </Link>
                ),
              },
              { title: "座位", dataIndex: "seatCode" },
              {
                title: "状态",
                render: (_, r) => (
                  <Tag color={STATUS_LABEL[r.status].color}>{STATUS_LABEL[r.status].text}</Tag>
                ),
              },
            ]}
          />
        </details>
      ) : null}
    </section>
  );
}
