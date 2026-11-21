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

const PHASES: Record<string, Shot[]> = {
  "1": [{ name: "style-guide", path: "/style-guide" }],
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
