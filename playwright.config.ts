import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const projects = [
  {
    name: "chromium",
    use: devices["Desktop Chrome"],
  },
];

if (process.env.E2E_WEBKIT === "1") {
  projects.push({
    name: "webkit",
    use: devices["Desktop Safari"],
  });
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,

  // CIはリトライ&並列抑制が無難
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // ユーザーを事前作成してからテスト開始
  globalSetup: require.resolve("./e2e/global-setup"),

  projects,
});
