import { expect, test } from '@playwright/test';

/**
 * Main path of the internal frontend: a person of the team signs in through the identity
 * provider (the fake one of the local stack, the same code flow with PKCE as Zitadel) and lands
 * on the application, with no error in the browser console.
 */
test('an internal user signs in and reaches the application', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).toHaveURL(/idp\.localhost:9400\/oauth\/v2\/authorize/);
  await page.locator('a[data-user="admin"]').click();

  await expect(page).toHaveURL(/localhost:3000\/(?!login)/);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '../../reports/screenshots/adoption/web-home.png', fullPage: true });
  await expect(page.getByRole('heading', { name: 'Proyectos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});
