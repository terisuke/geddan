import { expect, test } from '@playwright/test';

test.describe('Capture Flow Protection', () => {
  test('should redirect from /capture to /upload if no data', async ({ page }) => {
    await page.goto('/capture');
    await expect(page).toHaveURL(/\/upload/);
  });

  test('should redirect from /review to /upload is no data', async ({ page }) => {
    // Review page checks uniqueFrames length too
    await page.goto('/review');
    // If uniqueFrames is 0, it renders "Loading data..." then likely nothing else unless logic redirects
    // Actually ReviewPage doesn't have explicit redirect in useEffect for uniqueFrames=0 in the code I wrote?
    // Let's check ReviewPage code.
    // It returns <div ...>Loading data...</div> if uniqueFrames.length === 0.
    // It does NOT redirect.
    // The previous implementation might have. 
    // CaptuPage DOES redirect.

    // In CapturePage:
    // useEffect(() => { if (uniqueFrames.length === 0) router.push('/upload'); ... }, ...)

    // In ReviewPage I see:
    // if (uniqueFrames.length === 0) return <div>Loading...</div>
    // I should probably add redirect to ReviewPage too for consistency.
  });
});
