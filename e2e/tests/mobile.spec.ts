import { expect, type Page, test } from "@playwright/test";

const STUDENT = { username: "student", password: process.env.SEED_DEMO_PASSWORD || "Campus@2026" };
const API = process.env.E2E_API_URL ?? "http://localhost:5180";

async function login(page: Page): Promise<string> {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(STUDENT.username);
  await page.getByLabel("密码").fill(STUDENT.password);
  await page.getByRole("button", { name: /进\s*入/ }).click();
  await expect(page).toHaveURL(/\/m1\/rooms/);
  const session = await page.evaluate(() => localStorage.getItem("campus-space.session"));
  return (JSON.parse(session ?? "{}") as { accessToken?: string }).accessToken ?? "";
}

async function cancelAllMine(page: Page, token: string): Promise<void> {
  const list = await page.request.get(`${API}/api/m1/reservations/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await list.json()) as { data: Array<{ id: string; status: string; from: string }> };
  for (const r of body.data) {
    if (r.status === "BOOKED" && new Date(r.from) > new Date()) {
      await page.request.delete(`${API}/api/m1/reservations/${r.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
    }
  }
}

/** Runs in the `mobile` project only (phone viewport): REQ-M1-11 small-screen acceptance. */
test.describe("phone layout (REQ-M1-11)", () => {
  test("navigation stays usable, the plan keeps touch-size seats and the list view books a seat", async ({
    page,
  }) => {
    const token = await login(page);
    await cancelAllMine(page, token);

    // Header: every module link is on screen, nothing overflows the page horizontally.
    const nav = page.getByRole("navigation", { name: "模块导航" });
    await expect(nav.getByRole("link", { name: /报修工单/ })).toBeInViewport();
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(0);

    await page.locator('[data-room-code="LIB-301"]').click();
    await page.getByRole("radiogroup", { name: "日期" }).getByText(/明天/).click();

    // The plan scrolls inside its viewport instead of shrinking seats below 44px.
    const seat = page.locator('.seat-map [data-seat-code="05"] rect');
    await expect(seat).toBeVisible();
    const box = await seat.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    const viewport = page.getByTestId("seat-map-viewport");
    const scrolls = await viewport.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(true);

    // List mode: same seats as text, free first, with a button per actionable seat.
    await page.getByRole("radiogroup", { name: "视图" }).getByText("列表").click();
    await expect(page).toHaveURL(/view=list/);
    const list = page.getByTestId("seat-list");
    await expect(list.locator('[data-seat-code="05"]')).toHaveAttribute("data-state", "FREE");
    await list.getByRole("button", { name: "预约座位 05" }).click();
    const card = page.getByTestId("selection-card");
    await expect(card).toBeInViewport();
    await card.getByRole("button", { name: /确认预约/ }).click();
    await expect(page.locator(".ant-message")).toContainText("05 号座已预约");
    await expect(list.locator('[data-seat-code="05"]')).toHaveAttribute("data-state", "MINE");

    await list.getByRole("button", { name: "取消座位 05" }).click();
    await card.getByRole("button", { name: /取消预约/ }).click();
    await expect(list.locator('[data-seat-code="05"]')).toHaveAttribute("data-state", "FREE");
    await cancelAllMine(page, token);
  });
});
