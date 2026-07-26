import { test, expect } from '@playwright/test';

test('basic UI interactions', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example Domain/);
  await page.click('text=More information');
  await expect(page).toHaveURL(/https:\/\/www\.iana\.org\/domains\/example/);
});
