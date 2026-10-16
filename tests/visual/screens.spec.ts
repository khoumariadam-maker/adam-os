import { test, expect, Page } from '@playwright/test';

// Freeze everything that changes between runs: time, boot, sound prompt, live effects, network.
const prepare = async (page: Page, settings: Record<string, unknown> = {}) => {
  await page.clock.setFixedTime(new Date('2026-10-06T10:30:00Z'));
  await page.addInitScript((s) => {
    localStorage.setItem('adam_os_booted', '1');
    localStorage.setItem('adam_os_muted', 'true');
    localStorage.setItem(
      'adam_os_settings',
      JSON.stringify({ theme: 'dark', liveWallpaper: false, screensaver: false, customCursor: false, ...s })
    );
  }, settings);
  // GitHub widget: always show the offline fallback so screenshots don't depend on live data.
  await page.route('https://api.github.com/**', (route) => route.abort());
};

const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
};

test('home screen', async ({ page }) => {
  await prepare(page);
  await page.goto('/');
  await settle(page);
  await expect(page).toHaveScreenshot('home.png');
});

test('classic Windows 98 theme', async ({ page }) => {
  await prepare(page, { theme: 'classic' });
  await page.goto('/');
  await settle(page);
  await expect(page).toHaveScreenshot('home-classic.png');
});

test('projects window', async ({ page, isMobile }) => {
  await prepare(page);
  await page.goto('/');
  await settle(page);
  const icon = page.locator('[data-icon-id="projects"]');
  if (isMobile) await icon.tap();
  else await icon.dblclick();
  await expect(page.getByRole('dialog', { name: 'Projects.exe' })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot('projects.png');
});

test('arabic', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => localStorage.setItem('adam_os_lang', 'ar'));
  await page.goto('/');
  await settle(page);
  await expect(page).toHaveScreenshot('arabic.png');
});

test('plain résumé page', async ({ page }) => {
  await prepare(page);
  await page.goto('/resume/');
  await settle(page);
  await expect(page).toHaveScreenshot('resume.png');
});

test('no horizontal overflow on phones', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await prepare(page);
  await page.goto('/');
  await settle(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
