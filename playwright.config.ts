import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);

/**
 * E2E runs against a production build with its own throw-away embedded
 * database (.data/e2e), so it never touches your local demo data.
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    timezoneId: "Africa/Cairo",
    locale: "ar-EG",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `rm -rf .data/e2e && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/menu`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { PGLITE_DATA_DIR: ".data/e2e", AUTO_SEED: "true", PAYMENT_MODE: "mock", SITE_URL: `http://localhost:${PORT}` },
  },
});
