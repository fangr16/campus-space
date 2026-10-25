import { VersionInfoSchema } from "@campus/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/app-context";

const SERVICES = ["platform", "m1", "m2", "m3"] as const;

/**
 * Shows which commit each service is running. This is the on-screen half of the release and
 * rollback demo: after a deploy the footer must change, after a rollback it must change back.
 */
export function VersionBar() {
  return (
    <>
      {SERVICES.map((name) => (
        <ServiceVersion key={name} name={name} />
      ))}
    </>
  );
}

function ServiceVersion({ name }: { name: (typeof SERVICES)[number] }) {
  const query = useQuery({
    queryKey: ["version", name],
    queryFn: () => api.get(`/api/${name}/version`, VersionInfoSchema),
    staleTime: 60_000,
  });
  if (query.isPending) return <span data-service={name}>{name}: …</span>;
  if (query.isError) {
    return (
      <span data-service={name} data-state="error">
        {name}: 不可用
      </span>
    );
  }
  return (
    <span
      data-service={name}
      title={`构建于 ${query.data.buildTime}，启动于 ${query.data.startedAt}`}
    >
      {name}: {query.data.sha.slice(0, 7)}@{query.data.tag}
    </span>
  );
}
