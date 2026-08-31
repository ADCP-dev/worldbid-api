// Playwright config for WorldBid 3D E2E (T-019).
//
// Chromium is launched with SwiftShader — a software WebGL implementation — so
// the globe can initialize a real WebGL2 context in CI without a GPU.
// `--enable-unsafe-swiftshader` is required on recent Chromium to permit the
// software GL backend.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    // SwiftShader software WebGL so the globe can render without a GPU.
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium-swiftshader",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});