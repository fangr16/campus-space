import { ModulePlaceholder } from "../shell/ModulePlaceholder";

export function BookingsPage() {
  return (
    <ModulePlaceholder
      module="M2"
      title="整教室预约与审批"
      lede="有权限的申请人提交整教室使用申请，经多级审批通过后，该教室在时段内的全部座位在 M1 中被占用；驳回或超时撤销后回滚。"
      owner="模块组 2"
      firstTask="TASK-020"
      requirements={[
        { id: "REQ-M2-01", text: "申请权限门槛：哪些角色可以申请整教室" },
        { id: "REQ-M2-02", text: "申请提交：教室、时段、用途、人数" },
        { id: "REQ-M2-03", text: "多级审批：通过 / 驳回，含审批意见" },
        { id: "REQ-M2-04", text: "超时自动撤销（参数化）" },
        { id: "REQ-M2-05", text: "申请人查询与撤销" },
        { id: "REQ-X-02", text: "审批通过后向 M1 写回座位占用，驳回或撤销后释放" },
      ]}
    />
  );
}
