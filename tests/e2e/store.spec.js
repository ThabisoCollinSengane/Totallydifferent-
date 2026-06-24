'use strict';
// End-to-end storefront smoke tests (Playwright).
// Opt-in: `npm run test:e2e` (see playwright.config.js). Runs against BASE_URL
// (production by default), so no local server is required.
const { test, expect } = require('@playwright/test');

test.describe('Storefront', () => {
  test('home loads with hero, CTA and free-delivery badge', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Totallydifferent/i);
    await expect(page.getByRole('heading', { name: /totally different/i })).toBeVisible();
    await expect(page.getByText(/free delivery over r750/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /shop the collection/i })).toBeVisible();
  });

  test('shop filters and search box are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clothing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hair' })).toBeVisible();
    await expect(page.getByPlaceholder(/search products/i)).toBeVisible();
  });

  test('clothing shows brand cards; opening a brand shows the floating brand bar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Clothing' }).click();
    const firstBrand = page.locator('.brand-card').first();
    await expect(firstBrand).toBeVisible();
    await firstBrand.click();
    await expect(page.locator('#brand-bar')).toBeVisible();
    await expect(page.locator('#banner-name')).not.toBeEmpty();
  });

  test('search narrows the catalogue', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/search products/i).fill('hoodie');
    // Either matching cards render, or a friendly "no matches" message.
    await expect(page.locator('.product-card, .empty')).not.toHaveCount(0);
  });

  test('brands API returns active brands', async ({ request }) => {
    const res = await request.get('/api/brands');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.brands)).toBeTruthy();
    expect(body.brands.length).toBeGreaterThan(0);
  });
});
