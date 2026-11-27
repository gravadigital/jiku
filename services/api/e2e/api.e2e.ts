/**
 * End to end of the api's HTTP interface, against the product of `make up`.
 *
 * It enters as each actor does: an HTTP client with a real access token, signed by the fake
 * identity provider of the local stack (deploy/test/fake-idp) with the claims Zitadel puts. The
 * writes go all the way through NATS, the auth-callout and core to PostgreSQL, and are read back.
 *
 * API_URL and IDP_URL point elsewhere when needed (defaults: the ports `make up` publishes).
 */
import assert from 'assert';

const API_URL = (process.env.API_URL || 'http://localhost:3100').replace(/\/$/, '');
const IDP_URL = (process.env.IDP_URL || 'http://localhost:9400').replace(/\/$/, '');

async function tokenOf(user: string): Promise<string> {
  const response = await fetch(`${IDP_URL}/test/token?user=${user}`);
  assert.strictEqual(response.status, 200, `fake-idp did not give a token for ${user}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, body: json };
}

describe('api HTTP — end to end against make up', () => {
  const run = Date.now().toString(36);
  let admin: string;
  let user: string;
  let external: string;

  before(async () => {
    [admin, user, external] = await Promise.all([tokenOf('admin'), tokenOf('user'), tokenOf('external')]);
  });

  it('rejects a request without a token', async () => {
    const response = await call(null, 'GET', '/projects');
    assert.strictEqual(response.status, 401);
  });

  it('an admin creates a client and a project, and a user reads them back', async () => {
    const client = await call(admin, 'POST', '/clients', { name: `Cliente e2e ${run}`, description: '' });
    assert.ok([200, 201].includes(client.status), `POST /clients answered ${client.status}: ${JSON.stringify(client.body)}`);

    const clients = await call(user, 'GET', '/clients');
    assert.strictEqual(clients.status, 200);
    const created = (clients.body as Array<{ id: number; name: string }>).find((c) => c.name === `Cliente e2e ${run}`);
    assert.ok(created, 'the new client is listed');

    const project = await call(admin, 'POST', '/projects', {
      name: `Proyecto e2e ${run}`,
      code: `E2E${run}`.slice(0, 10).toUpperCase(),
      clientId: created!.id,
      status: 'activo',
      type: 'comercial',
      description: 'Creado por el test end to end',
      initDate: '2026-01-01',
    });
    assert.ok([200, 201].includes(project.status), `POST /projects answered ${project.status}: ${JSON.stringify(project.body)}`);

    const projects = await call(user, 'GET', '/projects');
    assert.strictEqual(projects.status, 200);
    const listed = (projects.body as Array<{ name: string }>).find((p) => p.name === `Proyecto e2e ${run}`);
    assert.ok(listed, 'the new project is listed');
  });

  it('a visitor with a shared-document link gets the public page, with no token', async () => {
    // Without the optional docs module in the local stack, every link answers the same generic
    // page, whatever the cause: that page is the entry of the "Documento compartido" surface.
    const response = await fetch(`${API_URL}/p/docs/not-a-real-token-${run}`);
    assert.strictEqual(response.status, 404);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.match(await response.text(), /Este link no está disponible/);
  });

  it('an internal user lists requirements; a client user is refused', async () => {
    const asUser = await call(user, 'GET', '/requirements?limit=5');
    assert.strictEqual(asUser.status, 200);
    const asExternal = await call(external, 'GET', '/requirements?limit=5');
    assert.strictEqual(asExternal.status, 403);
  });
});
