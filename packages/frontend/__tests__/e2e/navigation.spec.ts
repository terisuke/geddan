import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    await page.goto('/');
    
    // ランディングページからアップロードページへ
    await page.getByText('さっそく始める').click();
    await expect(page).toHaveURL('/upload');
    
    // ヘッダーのロゴをクリックでホームに戻る（将来的な機能）
    // 現在は実装されていないため、コメントアウト
  });

  test('should have proper page titles', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/DanceFrame/);
    
    await page.goto('/upload');
    await expect(page).toHaveTitle(/DanceFrame/);
  });
});

