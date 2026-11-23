import { expect, test } from "@playwright/test";

/** A fresh Egyptian number per run (per-phone promo/rate limits never interfere). */
const phone = () => `010${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

test("browse → add to cart → checkout → admin sees the order", async ({ page, browser }) => {
  // ── Browse ────────────────────────────────────────────────────────────────
  await page.goto("/menu");
  await expect(page.getByRole("heading", { level: 1, name: "المنيو" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "أقسام المنيو" })).toBeVisible();

  // Search narrows the menu (Arabic-insensitive search).
  await page.getByPlaceholder(/دوّر على أكلة/).fill("كفته");
  await expect(page.getByRole("link", { name: "كفتة مشوية" }).first()).toBeVisible();
  await page.getByRole("link", { name: "كفتة مشوية" }).first().click();

  // ── Item: size + add-on, then add to cart ─────────────────────────────────
  await expect(page.getByRole("heading", { level: 1, name: "كفتة مشوية" })).toBeVisible();
  await page.getByRole("radio", { name: /نص كيلو/ }).click();
  await page.getByRole("checkbox").first().check();
  const add = page.locator("form button[type=submit]");
  await expect(add).toContainText("430"); // 420 + 10 garlic sauce
  await add.click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByText("اتضاف للسلة").first()).toBeVisible();

  // ── Cart: zone + promo ────────────────────────────────────────────────────
  await page.goto("/cart");
  await page.locator("#cart-zone").selectOption({ label: "التجمع الخامس — 25 ج.م" });
  await page.locator("#promo").fill("WELCOME10");
  await page.locator("#promo").press("Enter");
  await expect(page.getByText("WELCOME10").first()).toBeVisible();
  // 430 − 43 (10%) + 25 delivery = 412
  await expect(page.getByRole("link", { name: /كمّل الطلب/ })).toContainText("412");
  await page.getByRole("link", { name: /كمّل الطلب/ }).click();

  // ── Checkout ──────────────────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/checkout$/);
  await page.fill("#name", "اختبار تلقائي");
  await page.fill("#phone", phone());
  await page.fill("#street", "شارع التسعين الشمالي");
  await page.fill("#building", "42");
  await page.fill("#landmark", "جنب مول ووترواي");
  // Works at any hour: when the restaurant is closed, schedule for opening time.
  if (await page.locator("button[role=radio][value=asap]").isDisabled()) {
    await page.locator("button[role=radio][value=scheduled]").click();
    await page.locator("#slot").selectOption({ index: 1 });
  }
  await page.locator("button[role=radio][value=cash]").click();
  await page.locator("form button[type=submit]").last().click();

  // ── Tracking ──────────────────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{32}$/);
  await expect(page.getByRole("heading", { name: "استلمنا الأوردر" })).toBeVisible();
  const orderText = await page.getByText(/أوردر #\d+/).first().innerText();
  const orderNumber = orderText.match(/#(\d+)/)?.[1];
  expect(orderNumber).toBeTruthy();
  await expect(page.getByText("412").first()).toBeVisible();

  // ── Admin sees it on the live board ───────────────────────────────────────
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/admin/login");
  await admin.fill("#email", "manager@fahmzaatar.test");
  await admin.fill("#password", "FahmZaatar@2026");
  await admin.locator("form button[type=submit]").click();
  await expect(admin).toHaveURL(/\/admin\/orders/);
  const card = admin.locator("article", { hasText: `#${orderNumber}` }).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("اختبار تلقائي");

  // Kitchen starts it → the customer's page updates live.
  await card.getByRole("button", { name: "ابدأ التحضير" }).click();
  await expect(page.getByRole("heading", { name: "بيتحضّر على الفحم" })).toBeVisible();
});

test("payments cannot be faked from the client (HMAC + server checks)", async ({ request }) => {
  const res = await request.post("/api/payments/mock/complete", {
    data: { paymentId: "00000000-0000-4000-8000-000000000000", outcome: "success" },
  });
  expect(res.status()).toBe(404);
  const hook = await request.post("/api/payments/paymob/webhook?hmac=deadbeef", {
    data: { type: "TRANSACTION", obj: { id: 1, success: true, amount_cents: 1, order: { id: 1 } } },
  });
  expect(hook.status()).toBe(401);
});
