/**
 * Full-page screenshots for phase reviews.
 *
 *   npm run screenshots -- --phase 1 [--base http://localhost:3000] [--only style-guide]
 *
 * Saves screenshots/phase-<n>/<page>-<locale>-<mobile|desktop>.png
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

interface Shot {
  name: string;
  path: string;
  /** Optional interaction before the shot (open a drawer, log in, …). */
  prepare?: (page: Page) => Promise<void>;
}

/** Builds a realistic cart through the UI (doubles as a smoke test of the order flow). */
async function fillCart(page: Page, base: string, prefix: string) {
  await page.goto(`${base}${prefix}/menu/grilled-kofta`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("fz-cart"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("form button[type=submit]").waitFor();
  await page.getByRole("radio").nth(1).click(); // ½ kg
  await page.getByRole("checkbox").first().click(); // extra garlic sauce
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/menu$/);
  await page.goto(`${base}${prefix}/menu/hummus`, { waitUntil: "domcontentloaded" });
  await page.locator("form button[type=submit]").waitFor();
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/menu$/);
  await page.goto(`${base}${prefix}/menu/lemon-mint`, { waitUntil: "domcontentloaded" });
  await page.locator("form button[type=submit]").waitFor();
  await page.getByRole("button", { name: /زوّد|Increase/ }).click(); // qty 2
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/menu$/);
}

async function fillCheckout(page: Page) {
  await page.locator("#name").waitFor();
  await page.fill("#name", "سارة كمال");
  // A fresh number each run so per-phone rate limits never interfere.
  await page.fill("#phone", `011${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`);
  await page.locator("#zoneId").selectOption({ index: 1 });
  await page.fill("#street", "شارع التسعين الشمالي");
  await page.fill("#building", "24");
  await page.fill("#floor", "3");
  await page.fill("#apartment", "12");
  await page.fill("#landmark", "جنب مول ووترواي");
  if (await page.locator("button[role=radio][value=asap]").isDisabled()) {
    await page.locator("button[role=radio][value=scheduled]").click();
    await page.locator("#slot").selectOption({ index: 1 });
  }
}

async function staffLogin(page: Page) {
  const url = new URL(page.url());
  if (!url.pathname.includes("/admin/login")) return;
  await page.fill("#email", "owner@fahmzaatar.test");
  await page.fill("#password", "FahmZaatar@2026");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/admin\/orders/, { timeout: 20000 });
}

/** Log in if needed, then (re)open the target admin page. */
const adminShot = (name: string, target: string): Shot => ({
  name,
  path: target,
  prepare: async (page) => {
    const prefix = new URL(page.url()).pathname.startsWith("/en") ? "/en" : "";
    await staffLogin(page);
    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}${prefix}${target}`, { waitUntil: "domcontentloaded" });
    await settle(page);
  },
});

const PHASES: Record<string, Shot[]> = {
  "1": [{ name: "style-guide", path: "/style-guide" }],
  "2": [
    { name: "home", path: "/" },
    { name: "menu", path: "/menu" },
    { name: "item-details", path: "/menu/grilled-kofta" },
    {
      name: "cart",
      path: "/cart",
      prepare: async (page) => {
        const url = new URL(page.url());
        const prefix = url.pathname.startsWith("/en") ? "/en" : "";
        await fillCart(page, url.origin, prefix);
        await page.goto(`${url.origin}${prefix}/cart`, { waitUntil: "domcontentloaded" });
        await page.locator("#cart-zone").waitFor();
        await page.locator("#cart-zone").selectOption({ index: 1 });
        await page.locator("#promo").fill("WELCOME10");
        await page.locator("#promo").press("Enter");
        await page.getByText("WELCOME10", { exact: true }).first().waitFor();
        await page.waitForTimeout(800);
        await settle(page);
      },
    },
  ],
  "3": [
    {
      name: "checkout",
      path: "/checkout",
      prepare: async (page) => {
        const url = new URL(page.url());
        const prefix = url.pathname.startsWith("/en") ? "/en" : "";
        await fillCart(page, url.origin, prefix);
        await page.goto(`${url.origin}${prefix}/checkout`, { waitUntil: "domcontentloaded" });
        await fillCheckout(page);
        await settle(page);
      },
    },
    {
      name: "order-tracking",
      path: "/",
      prepare: async (page) => {
        const url = new URL(page.url());
        const prefix = url.pathname.startsWith("/en") ? "/en" : "";
        await fillCart(page, url.origin, prefix);
        await page.goto(`${url.origin}${prefix}/checkout`, { waitUntil: "domcontentloaded" });
        await fillCheckout(page);
        await page.locator("button[role=radio][value=cash]").click();
        await page.locator("form button[type=submit]").last().click();
        await page.waitForURL(/\/orders\/[a-f0-9]{32}/, { timeout: 20000 });
        await settle(page);
      },
    },
  ],
  "4": [
    adminShot("admin-orders-board", "/admin/orders"),
    adminShot("admin-menu", "/admin/menu"),
    adminShot("admin-analytics", "/admin/analytics"),
    adminShot("admin-instapay", "/admin/instapay"),
    adminShot("admin-settings", "/admin/settings"),
  ],
};

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Trigger lazy images by scrolling through the page.
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? null
          : new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
              setTimeout(resolve, 5000);
            }),
      ),
    );
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
}

async function main() {
  const phase = arg("phase", "1")!;
  const base = arg("base", "http://localhost:3000")!;
  const only = arg("only");
  const locales = (arg("locales", "ar,en") ?? "ar,en").split(",");
  const shots = (PHASES[phase] ?? []).filter((s) => !only || s.name === only);
  if (!shots.length) throw new Error(`no shots configured for phase ${phase}`);

  const outDir = path.join(process.cwd(), "screenshots", `phase-${phase}`);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [device, viewport] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 2,
        isMobile: device === "mobile",
        hasTouch: device === "mobile",
        timezoneId: "Africa/Cairo",
        locale: "ar-EG",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      for (const shot of shots) {
        for (const locale of locales) {
          const url = `${base}${locale === "ar" ? "" : `/${locale}`}${shot.path}`;
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await settle(page);
          if (shot.prepare) await shot.prepare(page);
          const file = path.join(outDir, `${shot.name}-${locale}-${device}.png`);
          await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
          console.log(`✓ ${path.relative(process.cwd(), file)}`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
