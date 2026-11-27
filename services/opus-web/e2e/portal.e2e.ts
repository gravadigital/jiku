import { expect, test } from '@playwright/test';
import { Client } from 'pg';

/**
 * Main path of the client portal: a client's user signs in through the identity provider (the
 * fake one of the local stack, the same code flow with PKCE as Zitadel) and sees the projects
 * they have access to, with no error in the browser console.
 *
 * Test data: the project is created through the api by an admin, as the team does. The access of
 * the client's user to it has no operation in the product (it is managed in the database), so
 * the test grants it there.
 */
const API_URL = process.env.API_URL || 'http://localhost:3100';
const IDP_URL = process.env.IDP_URL || 'http://localhost:9400';
const EXTERNAL = { sub: '300000000000000003', username: 'external', name: 'Elena Externa', email: 'external@jiku.test' };

async function tokenOf(user: string): Promise<string> {
  const response = await fetch(`${IDP_URL}/test/token?user=${user}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function api(token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  expect(response.ok, `${method} ${path} answered ${response.status}`).toBe(true);
  return response.json();
}

test('a client user signs in and sees the projects they have access to', async ({ page }) => {
  const run = Date.now().toString(36);
  const projectName = `Portal e2e ${run}`;
  const admin = await tokenOf('admin');
  await api(admin, 'POST', '/clients', { name: `Cliente portal ${run}`, description: '' });
  const clients = (await api(admin, 'GET', '/clients')) as Array<{ id: number; name: string }>;
  const client = clients.find((c) => c.name === `Cliente portal ${run}`)!;
  await api(admin, 'POST', '/projects', {
    name: projectName,
    code: `P${run}`.slice(0, 10).toUpperCase(),
    clientId: client.id,
    status: 'activo',
    type: 'comercial',
    description: 'Proyecto visible para el cliente',
    initDate: '2026-01-01',
  });
  const projects = (await api(admin, 'GET', '/projects')) as Array<{ id: number; name: string }>;
  const project = projects.find((p) => p.name === projectName)!;

  const db = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER || 'jiku',
    password: process.env.DATABASE_PASSWORD || 'jiku',
    database: process.env.DATABASE_NAME || 'jiku',
  });
  await db.connect();
  try {
    await db.query(
      `INSERT INTO users (id, name, username, email, roles, identity_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '["external-user"]', 'person', now(), now()) ON CONFLICT (id) DO NOTHING`,
      [EXTERNAL.sub, EXTERNAL.name, EXTERNAL.username, EXTERNAL.email]
    );
    await db.query('INSERT INTO user_project_permissions (user_id, project_id) VALUES ($1, $2)', [EXTERNAL.sub, project.id]);
  } finally {
    await db.end();
  }

  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole('button', { name: /Iniciar sesión|Ingresar/ }).click();
  await expect(page).toHaveURL(/idp\.localhost:9400\/oauth\/v2\/authorize/);
  await page.locator('a[data-user="external"]').click();

  // /projects redirects to the requirements of the first project the user can see.
  await expect(page).toHaveURL(/localhost:3001\/projects\/\d+\/requirements/);
  await expect(page.getByText(projectName)).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '../../reports/screenshots/adoption/opus-web-projects.png', fullPage: true });
  expect(errors, errors.join('\n')).toEqual([]);
});
