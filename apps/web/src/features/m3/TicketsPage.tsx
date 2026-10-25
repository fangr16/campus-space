import { ModulePlaceholder } from "../shell/ModulePlaceholder";

export function TicketsPage() {
  return (
    <ModulePlaceholder
      module="M3"
      title="物业报修工单"
      lede="师生上报自习室或座位故障，物业派单、维修、验收。维修中的自习室其座位在 M1 中自动下架，验收通过后恢复。"
      owner="模块组 3"
      firstTask="TASK-030"
      requirements={[
        { id: "REQ-M3-01", text: "故障上报：位置、类型、描述、照片（可选）" },
        { id: "REQ-M3-02", text: "派单：维修人员与优先级" },
        { id: "REQ-M3-03", text: "维修中状态流转" },
        { id: "REQ-M3-04", text: "SLA 超时升级" },
        { id: "REQ-M3-05", text: "完工验收与评价，可返工" },
        { id: "REQ-X-01", text: "维修中向 M1 写回座位下架，验收通过后恢复" },
      ]}
    />
  );
}
