import type { DispatchTicketRequest, ReportTicketRequest } from "@campus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App as AntApp, Button, Form, Input, InputNumber, Select, Table, Tag } from "antd";
import { useState } from "react";
import { ApiClientError } from "../../lib/api-client";
import { useSession } from "../../lib/app-context";
import {
  acceptTicket,
  completeTicket,
  dispatchTicket,
  fetchTicketEvents,
  fetchTickets,
  rejectTicket,
  reportTicket,
  startTicket,
} from "./api";
import {
  availableActions,
  CATEGORY_OPTIONS,
  describeEvent,
  describeLocation,
  formatM3Time,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from "./tickets.model";
import "./tickets.css";

/** REQ-M3-01..05: report, track, dispatch, repair and accept tickets from one page. */
export function TicketsPage() {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const session = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportForm] = Form.useForm<ReportTicketRequest>();
  const [dispatchForm] = Form.useForm<DispatchTicketRequest & { slaDueLocal: string }>();
  const [ratingForm] = Form.useForm<{ rating: number }>();
  const [reasonForm] = Form.useForm<{ reason: string }>();

  const tickets = useQuery({ queryKey: ["m3", "tickets"], queryFn: fetchTickets });
  const events = useQuery({
    queryKey: ["m3", "events", selectedId],
    queryFn: () => fetchTicketEvents(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["m3"] });
  const onError = (error: unknown) =>
    message.error(error instanceof ApiClientError ? error.message : "操作失败，请稍后再试");

  const report = useMutation({
    mutationFn: (input: ReportTicketRequest) => reportTicket(input),
    onSuccess: (dto) => {
      message.success("报修已提交");
      reportForm.resetFields();
      setSelectedId(dto.id);
      refresh();
    },
    onError,
  });
  const dispatch = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DispatchTicketRequest }) =>
      dispatchTicket(id, input),
    onSuccess: () => {
      message.success("已派单");
      dispatchForm.resetFields();
      refresh();
    },
    onError,
  });
  const start = useMutation({
    mutationFn: startTicket,
    onSuccess: () => {
      message.success("已开始维修");
      refresh();
    },
    onError,
  });
  const complete = useMutation({
    mutationFn: completeTicket,
    onSuccess: () => {
      message.success("已标记完工，等待上报人验收");
      refresh();
    },
    onError,
  });
  const accept = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => acceptTicket(id, { rating }),
    onSuccess: () => {
      message.success("验收通过");
      ratingForm.resetFields();
      refresh();
    },
    onError,
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTicket(id, { reason }),
    onSuccess: () => {
      message.success("已退回返工");
      reasonForm.resetFields();
      refresh();
    },
    onError,
  });

  const selected = tickets.data?.find((ticket) => ticket.id === selectedId) ?? null;
  const actions = selected && session ? availableActions(selected, session.user) : [];

  return (
    <section aria-labelledby="tickets-title">
      <header className="page__head">
        <div>
          <p className="page__eyebrow">M3 · 物业报修工单</p>
          <h1 id="tickets-title" className="page__title">
            物业报修工单
          </h1>
          <p className="page__lede">
            上报故障后由物业派单维修；维修中的自习室座位在 M1
            中自动下架，验收通过后恢复（REQ-X-01）。
          </p>
        </div>
      </header>

      <div className="tickets-layout">
        <div>
          <section aria-labelledby="report-title" className="tickets-panel">
            <h2 id="report-title" className="tickets-panel__title">
              故障上报
            </h2>
            <Form form={reportForm} layout="vertical" onFinish={(values) => report.mutate(values)}>
              <Form.Item
                name="roomId"
                label="自习室编号"
                rules={[{ required: true, whitespace: true }]}
              >
                <Input placeholder="例如 room-1" />
              </Form.Item>
              <Form.Item name="seatId" label="座位编号（可选）">
                <Input placeholder="留空表示整室故障" />
              </Form.Item>
              <Form.Item name="category" label="故障类型" rules={[{ required: true }]}>
                <Select options={CATEGORY_OPTIONS} placeholder="选择类型" />
              </Form.Item>
              <Form.Item
                name="description"
                label="故障描述"
                rules={[{ required: true, whitespace: true }]}
              >
                <Input.TextArea rows={3} placeholder="描述故障现象" />
              </Form.Item>
              <Form.Item name="photoRef" label="照片引用（可选）">
                <Input placeholder="附件引用，不存图片本身" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={report.isPending}>
                提交报修
              </Button>
            </Form>
          </section>

          <section aria-labelledby="list-title" className="tickets-panel">
            <h2 id="list-title" className="tickets-panel__title">
              我的工单
            </h2>
            {tickets.isPending ? <p className="state">正在加载工单…</p> : null}
            {tickets.isError ? (
              <p className="state" data-kind="error" role="alert">
                加载失败：{tickets.error.message}
              </p>
            ) : null}
            {tickets.data?.length === 0 ? <p className="state">还没有工单。</p> : null}
            {tickets.data && tickets.data.length > 0 ? (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={tickets.data}
                onRow={(record) => ({ onClick: () => setSelectedId(record.id) })}
                columns={[
                  { title: "位置", render: (_, t) => describeLocation(t) },
                  { title: "类型", dataIndex: "category" },
                  {
                    title: "状态",
                    render: (_, t) => (
                      <Tag color={STATUS_LABEL[t.status].color}>{STATUS_LABEL[t.status].text}</Tag>
                    ),
                  },
                  { title: "优先级", render: (_, t) => PRIORITY_LABEL[t.priority] },
                  { title: "更新时间", render: (_, t) => formatM3Time(t.updatedAt) },
                ]}
              />
            ) : null}
          </section>
        </div>

        <section aria-labelledby="detail-title" className="tickets-panel">
          <h2 id="detail-title" className="tickets-panel__title">
            工单详情
          </h2>
          {!selected ? <p className="state">从左侧列表选择一张工单。</p> : null}
          {selected ? (
            <>
              <dl className="tickets-detail">
                <dt>工单号</dt>
                <dd>{selected.id}</dd>
                <dt>状态</dt>
                <dd>
                  <Tag color={STATUS_LABEL[selected.status].color}>
                    {STATUS_LABEL[selected.status].text}
                  </Tag>
                </dd>
                <dt>描述</dt>
                <dd>{selected.description}</dd>
                <dt>维修人员</dt>
                <dd>{selected.assigneeId ?? "未指派"}</dd>
                <dt>期限</dt>
                <dd>{formatM3Time(selected.slaDueAt)}</dd>
                <dt>评分</dt>
                <dd>{selected.rating ?? "—"}</dd>
              </dl>

              {actions.includes("dispatch") ? (
                <Form
                  form={dispatchForm}
                  layout="vertical"
                  onFinish={(values) =>
                    dispatch.mutate({
                      id: selected.id,
                      input: {
                        assigneeId: values.assigneeId,
                        priority: values.priority,
                        slaDueAt: new Date(values.slaDueLocal).toISOString(),
                      },
                    })
                  }
                >
                  <h3>派单</h3>
                  <Form.Item name="assigneeId" label="维修人员编号" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
                    <Select
                      options={Object.entries(PRIORITY_LABEL).map(([value, label]) => ({
                        value,
                        label,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="slaDueLocal" label="期限" rules={[{ required: true }]}>
                    <Input type="datetime-local" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={dispatch.isPending}>
                    派单
                  </Button>
                </Form>
              ) : null}

              <div className="tickets-actions">
                {actions.includes("start") ? (
                  <Button loading={start.isPending} onClick={() => start.mutate(selected.id)}>
                    开始维修
                  </Button>
                ) : null}
                {actions.includes("complete") ? (
                  <Button loading={complete.isPending} onClick={() => complete.mutate(selected.id)}>
                    标记完工
                  </Button>
                ) : null}
                {actions.includes("accept") ? (
                  <Form
                    form={ratingForm}
                    layout="inline"
                    onFinish={({ rating }) => accept.mutate({ id: selected.id, rating })}
                  >
                    <Form.Item name="rating" rules={[{ required: true }]}>
                      <InputNumber min={1} max={5} placeholder="评分 1-5" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={accept.isPending}>
                      验收通过
                    </Button>
                  </Form>
                ) : null}
                {actions.includes("reject") ? (
                  <Form
                    form={reasonForm}
                    layout="vertical"
                    onFinish={({ reason }) => reject.mutate({ id: selected.id, reason })}
                  >
                    <Form.Item
                      name="reason"
                      label="返工原因"
                      rules={[{ required: true, whitespace: true }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                    <Button danger htmlType="submit" loading={reject.isPending}>
                      退回返工
                    </Button>
                  </Form>
                ) : null}
              </div>

              <h3 className="tickets-panel__title">事件历史</h3>
              {events.isPending ? <p className="state">正在加载历史…</p> : null}
              {events.isError ? (
                <p className="state" data-kind="error" role="alert">
                  加载历史失败：{events.error.message}
                </p>
              ) : null}
              {events.data?.length === 0 ? <p className="state">暂无事件。</p> : null}
              <ol className="tickets-timeline">
                {events.data?.map((event) => (
                  <li key={event.id}>
                    {describeEvent(event)} <small>{formatM3Time(event.createdAt)}</small>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
