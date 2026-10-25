import { Button } from "antd";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { authStore, useSession } from "../../lib/app-context";
import { VersionBar } from "./VersionBar";

const NAV = [
  { to: "/m1/rooms", label: "自习座位", module: "M1" },
  { to: "/m2", label: "整教室预约", module: "M2" },
  { to: "/m3", label: "报修工单", module: "M3" },
] as const;

/** Authenticated frame: header with module navigation, page outlet, version footer. */
export function AppShell() {
  const session = useSession();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="shell">
      <header className="shell__header">
        <Link to="/" className="shell__brand">
          校园资源服务平台
          <small>自习座位 · 整教室预约 · 物业报修</small>
        </Link>
        <nav className="shell__nav" aria-label="模块导航">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <span aria-hidden="true">{item.module} · </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <span className="shell__user">
          {session.user.displayName}（{session.user.roles.join(", ")}）
        </span>
        <Button size="small" onClick={() => authStore.signOut()}>
          退出
        </Button>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
      <footer className="shell__footer">
        <VersionBar />
      </footer>
    </div>
  );
}
