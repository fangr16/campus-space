import { expect, test as setup } from "@playwright/test";

const STUDENT = { username: "student", password: process.env.SEED_DEMO_PASSWORD || "Campus@2026" };

/**
 * Visits every route once before the real tests. On a cold Vite dev server the first visit of
 * a page can trigger dependency optimization and a full reload in the middle of a test; the
 * warm-up absorbs that so the scenarios below see a stable app.
 */
setup("warm up the dev server", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(STUDENT.username);
  await page.getByLabel("密码").fill(STUDENT.password);
  await page.getByRole("button", { name: /进\s*入/ }).click();
  await expect(page).toHaveURL(/\/m1\/rooms/);

  await page.locator('[data-room-code="LIB-301"]').click();
  await expect(page.locator(".seat-map [data-seat-code]").first()).toBeVisible();
  const seat = page.getByRole("button", { name: /座位 05/ });
  await seat.click();
  await expect(page.getByTestId("selection-card")).toBeVisible();
  await page.getByRole("button", { name: "取消选择" }).click();
  await page.getByRole("radiogroup", { name: "视图" }).getByText("列表").click();
  await expect(page.getByTestId("seat-list")).toBeVisible();

  await page.goto("/m1/reservations");
  await expect(page.getByRole("heading", { level: 1, name: "我的预约" })).toBeVisible();
  await page.goto("/m2");
  await page.goto("/m3");
  // Give a possible "new dependencies optimized, reloading" cycle time to settle.
  await page.waitForTimeout(1500);
});
