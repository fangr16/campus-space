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

/** Leaves no BOOKED reservation behind so the run is repeatable (seat and user overlap rules). */
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

/** Opens LIB-301 for tomorrow, so the offered start is always in the future. */
async function openRoomTomorrow(page: Page): Promise<void> {
  await page.locator('[data-room-code="LIB-301"]').click();
  await expect(page.locator(".seat-map [data-seat-code]").first()).toBeVisible();
  await page.getByRole("radiogroup", { name: "日期" }).getByText(/明天/).click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
}

const seatOnMap = (page: Page, code: string) =>
  page.locator(`.seat-map [data-seat-code="${code}"]`);

test.describe("time-first seat reservation (REQ-M1-04, REQ-M1-11)", () => {
  test("student picks a start, reserves a free seat in place, sees it listed and cancels it", async ({
    page,
  }) => {
    const token = await login(page);
    await cancelAllMine(page, token);
    await openRoomTomorrow(page);

    // Every seat is free for the chosen start; the summary and the map agree.
    await expect(page.getByTestId("seat-summary")).toContainText("空闲 40 / 40");
    await expect(seatOnMap(page, "05")).toHaveAttribute("data-state", "FREE");

    await page.getByRole("button", { name: "预约座位 05" }).click();
    const card = page.getByTestId("selection-card");
    await expect(card).toContainText("05");
    await expect(card.getByLabel("时长")).toBeVisible();
    await card.getByRole("button", { name: /确认预约/ }).click();

    await expect(page.locator(".ant-message")).toContainText("05 号座已预约");
    await expect(card).toBeHidden();
    await expect(seatOnMap(page, "05")).toHaveAttribute("data-state", "MINE");
    await expect(page.getByTestId("held-banner")).toContainText("05 号座");
    await expect(page.getByTestId("seat-summary")).toContainText("空闲 39 / 40");

    await page.getByRole("link", { name: "我的预约" }).first().click();
    await expect(page).toHaveURL(/\/m1\/reservations$/);
    // A reservation that is already running (cannot be cancelled) may also be listed for the
    // seat, so count the cancel buttons rather than the cards.
    const cancelButton = page.getByTestId("cancel-05");
    await expect(cancelButton).toHaveCount(1);
    await cancelButton.click();
    await expect(page.locator(".ant-message")).toContainText("已取消");
    await expect(cancelButton).toHaveCount(0);
  });

  test("a second seat in the same period is refused with the rule, and the first is released from the map", async ({
    page,
  }) => {
    const token = await login(page);
    await cancelAllMine(page, token);
    await openRoomTomorrow(page);

    await page.getByRole("button", { name: "预约座位 06" }).click();
    await page
      .getByTestId("selection-card")
      .getByRole("button", { name: /确认预约/ })
      .click();
    await expect(seatOnMap(page, "06")).toHaveAttribute("data-state", "MINE");

    await page.getByRole("button", { name: "预约座位 07" }).click();
    const card = page.getByTestId("selection-card");
    await card.getByRole("button", { name: /确认预约/ }).click();
    await expect(card.getByRole("alert")).toContainText("你在该时段已经持有一个座位");
    await expect(seatOnMap(page, "07")).toHaveAttribute("data-state", "FREE");

    // Own seats are buttons too; the card then offers cancellation instead of booking.
    await page.getByRole("button", { name: "我的座位 06" }).click();
    await card.getByRole("button", { name: /取消预约/ }).click();
    await expect(page.locator(".ant-message")).toContainText("06 号座的预约已取消");
    await expect(seatOnMap(page, "06")).toHaveAttribute("data-state", "FREE");
    await cancelAllMine(page, token);
  });
});
