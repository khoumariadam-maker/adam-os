import { defineConfig, devices } from '@playwright/test';

// Visual regression tests: `npm run build && npm run test:visual`.
// Update baselines after an intended visual change with `npm run test:visual -- --update-snapshots`.
export default defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  fullyParallel: true,
  reporter: [['list']],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' } },
  use: {
    baseURL: 'http://localhost:4173',
    contextOptions: { reducedMotion: 'reduce' },
    timezoneId: 'UTC',
    locale: 'en-US',
    // Optional: point at a preinstalled Chromium instead of `npx playwright install`.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node scripts/serve-out.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
