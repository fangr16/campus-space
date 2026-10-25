import { type LoginRequest, LoginResponseSchema } from "@campus/contracts";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Form, Input } from "antd";
import { Navigate, useNavigate } from "react-router";
import { ApiClientError } from "../../lib/api-client";
import { api, authStore, useSession } from "../../lib/app-context";

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "用户名或密码不正确",
  VALIDATION_FAILED: "请输入用户名和密码",
  INTERNAL: "服务暂时不可用，请稍后再试",
};

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const login = useMutation({
    mutationFn: (values: LoginRequest) =>
      api.post("/api/platform/auth/login", LoginResponseSchema, values),
    onSuccess: (data) => {
      authStore.signIn({ accessToken: data.accessToken, user: data.user });
      navigate("/m1/rooms", { replace: true });
    },
  });

  if (session) return <Navigate to="/m1/rooms" replace />;

  const errorText =
    login.error instanceof ApiClientError
      ? (MESSAGES[login.error.code] ?? login.error.message)
      : login.error
        ? MESSAGES.INTERNAL
        : null;

  return (
    <main className="login">
      <section className="login__card" aria-labelledby="login-title">
        <p className="page__eyebrow">校园资源服务平台</p>
        <h1 id="login-title" className="page__title" style={{ fontSize: "var(--text-lg)" }}>
          登录
        </h1>
        <Form<LoginRequest>
          layout="vertical"
          onFinish={(values) => login.mutate(values)}
          disabled={login.isPending}
          style={{ marginTop: "var(--space-4)" }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          {errorText ? (
            <Form.Item>
              <Alert type="error" showIcon message={errorText} role="alert" />
            </Form.Item>
          ) : null}
          <Button type="primary" htmlType="submit" block loading={login.isPending}>
            进入
          </Button>
        </Form>
        <p className="login__hint">
          开发环境演示账号见 <code>docs/ops/environments.md</code>。
        </p>
      </section>
    </main>
  );
}
