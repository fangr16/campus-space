import { expect, type Page, test } from "@playwright/test";

const STUDENT = { username: "student", password: process.env.SEED_DEMO_PASSWORD || "Campus@2026" };

// Ant Design inserts a space between two-character CJK button labels ("进 入"), so match loosely.
const ENTER_BUTTON = /进\s*入/;
const SIGN_OUT_BUTTON = /退\s*出/;

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: ENTER_BUTTON }).click();
}

test.describe("campus-space smoke", () => {
  test("rejects a wrong password with a visible message", async ({ page }) => {
    await login(page, STUDENT.username, "wrong-password");
    await expect(page.getByRole("alert")).toContainText("用户名或密码不正确");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("student logs in, browses rooms and reads the floor plan with power coverage", async ({
    page,
  }) => {
    await login(page, STUDENT.username, STUDENT.password);

    await expect(page).toHaveURL(/\/m1\/rooms$/);
    await expect(page.getByRole("heading", { level: 1, name: "自习室" })).toBeVisible();
    const lib = page.locator('[data-room-code="LIB-301"]');
    await expect(lib).toBeVisible();
    await expect(page.locator('[data-room-code="CS-304"]')).toBeVisible();

    await lib.click();
    await expect(page).toHaveURL(/\/m1\/rooms\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "图书馆三楼自习室" })).toBeVisible();

    // REQ-M1-10: the floor plan draws every seat at its position and every outlet with its reach.
    const seats = page.locator(".seat-map [data-seat-code]");
    const outlets = page.locator(".seat-map [data-outlet-code]");
    await expect(seats).toHaveCount(40);
    await expect(outlets).toHaveCount(3);
    await expect(page.locator(".seat-map [data-outlet-range]")).toHaveCount(3);
    await expect(page.getByTestId("seat-summary")).toContainText("显示 40 个");

    // Highlighted seats on the map must match the count the API derived from outlet ranges.
    const summaryText = (await page.getByTestId("seat-summary").textContent()) ?? "";
    const derived = Number(/覆盖范围内 (\d+) 个/.exec(summaryText)?.[1]);
    expect(derived).toBeGreaterThan(0);
    await expect(page.locator('.seat-map [data-seat-code][data-power="true"]')).toHaveCount(
      derived,
    );

    // antd Segmented hides the radio input; click its visible label inside the group instead.
    await page.getByRole("radiogroup", { name: "座位筛选" }).getByText("靠近插座").click();
    await expect(seats).toHaveCount(derived);
    await expect(page.getByTestId("seat-summary")).toContainText(`显示 ${derived} 个`);
    await expect(outlets).toHaveCount(3);
    await expect(seats.first()).toHaveAttribute("data-power", "true");
  });

  test("shows the running version of every service in the footer", async ({ page }) => {
    await login(page, STUDENT.username, STUDENT.password);
    const footer = page.locator("footer.shell__footer");
    for (const name of ["platform", "m1", "m2", "m3"]) {
      const entry = footer.locator(`[data-service="${name}"]`);
      await expect(entry).not.toHaveAttribute("data-state", "error");
      await expect(entry).toContainText(`${name}: `);
      await expect(entry).not.toContainText("…");
    }
  });

  test("module placeholders state their requirements", async ({ page }) => {
    await login(page, STUDENT.username, STUDENT.password);
    const nav = page.getByRole("navigation", { name: "模块导航" });
    await nav.getByRole("link", { name: /整教室预约/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "整教室预约与审批" })).toBeVisible();
    await expect(page.getByText("REQ-M2-03")).toBeVisible();
    await nav.getByRole("link", { name: /报修工单/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "物业报修工单" })).toBeVisible();
    await expect(page.getByText("REQ-X-01")).toBeVisible();
  });

  test("signing out returns to the login page and protects routes", async ({ page }) => {
    await login(page, STUDENT.username, STUDENT.password);
    await page.getByRole("button", { name: SIGN_OUT_BUTTON }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/m1/rooms");
    await expect(page).toHaveURL(/\/login$/);
  });
});
