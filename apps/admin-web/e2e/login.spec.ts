import { expect, test, type Page } from '@playwright/test';

// Role checks sign in as seeded demo users, so they only run when E2E_PASSWORD is provided.
const password = process.env.E2E_PASSWORD;

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

test('everyone signs in on the same form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test.describe('permission-driven navigation', () => {
  test.skip(!password, 'Set E2E_PASSWORD to run sign-in checks against the seeded demo users');

  test('administrator sees administration modules', async ({ page }) => {
    await signIn(page, 'kevin@lakeviewmarine.co.ke');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const label of ['Dashboard', 'Invoices', 'Inventory', 'Users', 'Roles & permissions', 'Audit log']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
  });

  test('store manager lands in the same app without finance or user admin', async ({ page }) => {
    await signIn(page, 'george@lakeviewmarine.co.ke');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: /^Inventory/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Purchase orders', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Invoices', exact: true })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await page.goto('/invoices');
    await expect(page).not.toHaveURL(/\/invoices$/);
    await page.goto('/users');
    await expect(page).not.toHaveURL(/\/users$/);
  });

  test('supplier only sees their purchase orders', async ({ page }) => {
    await signIn(page, 'supplier@kenyamarine.co.ke');
    await expect(page).toHaveURL(/\/my-orders$/);
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'My purchase orders', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/my-orders$/);
  });
});
