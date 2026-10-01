import { expect, type Page } from '@playwright/test';

const mobileViewports = [320, 390, 430] as const;

export async function expectMobileLayout(page: Page) {
  for (const width of mobileViewports) {
    await page.setViewportSize({ width, height: 780 });
    await expect
      .poll(() =>
        page.evaluate<number>(
          'document.documentElement.scrollWidth - document.documentElement.clientWidth',
        ),
      )
      .toBeLessThanOrEqual(0);
  }
}
