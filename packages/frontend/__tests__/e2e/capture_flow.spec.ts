import { expect, test } from '@playwright/test';

test.describe('Capture Flow Protection', () => {
  test('should redirect from /capture to /upload if no data', async ({ page }) => {
    await page.goto('/capture');
    await expect(page).toHaveURL(/\/upload/);
  });

  test('should redirect from /review to /upload if no data', async ({ page }) => {
    // Review page now has useEffect redirect when uniqueFrames.length === 0
    await page.goto('/review');
    await expect(page).toHaveURL(/\/upload/);
  });
});
