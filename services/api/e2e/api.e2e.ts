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
import { execFileSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import path from 'path';
import { ZitadelServiceUser } from '@jiku/zitadel-auth';

const API_URL = (process.env.API_URL || 'http://localhost:3100').replace(/\/$/, '');
const IDP_URL = (process.env.IDP_URL || 'http://localhost:9400').replace(/\/$/, '');
// The public shared-document pages answer only on the host of the api's JIKU_PUBLIC_URL
// (docker-compose.yml: http://127.0.0.1:3100); on any other host they are the generic 404.
const PUBLIC_URL = (process.env.PUBLIC_URL || 'http://127.0.0.1:3100').replace(/\/$/, '');
// The one link the fake jiku-docs module of the local stack resolves (deploy/test/fake-docs).
const SHARE_TOKEN = process.env.FAKE_DOCS_SHARE_TOKEN || 'jds_e2e-shared-document-00000000000000000000000';

// The OIDC application of both frontends in the local stack (docker-compose.yml) and its project.
const CLIENT_ID = process.env.IDENTITY_CLIENT_ID || 'jiku-web';
const PROJECT_ID = process.env.IDENTITY_PROJECT_ID || 'jiku-project';
const ROOT = path.join(__dirname, '..', '..', '..');

/** `variant`: `other-issuer` or `other-project`, the refused tokens of #626 (deploy/test/fake-idp). */
async function tokenOf(user: string, variant?: string): Promise<string> {
  const response = await fetch(`${IDP_URL}/test/token?user=${user}${variant ? `&variant=${variant}` : ''}`);
  assert.strictEqual(response.status, 200, `fake-idp did not give a token for ${user}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/**
 * The access token the frontends get: the authorization code flow with PKCE of their OIDC
 * application, with the scopes they ask for (services/web/src/lib/auth.ts).
 */
async function frontendTokenOf(user: string): Promise<string> {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const redirectUri = 'http://localhost:3000/api/auth/callback/zitadel';
  const authorize = new URL(`${IDP_URL}/oauth/v2/authorize`);
  authorize.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: `openid profile email urn:zitadel:iam:org:projects:roles urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud`,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    login_hint: user,
  }).toString();
  const redirect = await fetch(authorize, { redirect: 'manual' });
  const code = new URL(redirect.headers.get('location') || '').searchParams.get('code');
  assert.ok(code, 'the fake identity provider gave an authorization code');
  const response = await fetch(`${IDP_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: CLIENT_ID, code_verifier: verifier }),
  });
  assert.strictEqual(response.status, 200);
  return ((await response.json()) as { access_token: string }).access_token;
}

/** The machine token `@jiku/zitadel-auth` gets with the api's key (in the `idp-keys` volume). */
async function machineTokenOf(username: string): Promise<string> {
  const key = execFileSync(
    'docker',
    ['compose', '-f', path.join(ROOT, 'docker-compose.yml'), 'exec', '-T', 'fake-idp', 'cat', `/keys/${username}.json`],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }
  ).toString();
  return new ZitadelServiceUser({ key: JSON.parse(key), issuer: IDP_URL, projectId: PROJECT_ID }).token();
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

  it('[ACC-E1] [626-AC-01] refuses a token of another issuer, even an admin one, with 401', async () => {
    const foreign = await tokenOf('admin', 'other-issuer');
    for (const [method, route, body] of [['GET', '/projects'], ['POST', '/clients', { name: `Ajeno ${run}`, description: '' }]] as const) {
      const response = await call(foreign, method, route, body);
      assert.strictEqual(response.status, 401, `${method} ${route} answered ${response.status}`);
      assert.deepStrictEqual(response.body, { code: 'unauthorized', message: 'Unauthorized' });
    }
  });

  it('[ACC-E1] [626-AC-01] refuses an admin or user of another project of the instance with 401', async () => {
    for (const who of ['admin', 'user']) {
      const foreign = await tokenOf(who, 'other-project');
      const read = await call(foreign, 'GET', '/projects');
      assert.strictEqual(read.status, 401, `GET /projects as ${who} of another project answered ${read.status}`);
      assert.deepStrictEqual(read.body, { code: 'unauthorized', message: 'Unauthorized' });
      const write = await call(foreign, 'POST', '/clients', { name: `Ajeno ${who} ${run}`, description: '' });
      assert.strictEqual(write.status, 401, `POST /clients as ${who} of another project answered ${write.status}`);
    }
  });

  it('[626-AC-02] the frontends\' token is still accepted with its roles', async () => {
    const asUser = await call(await frontendTokenOf('user'), 'GET', '/requirements?limit=5');
    assert.strictEqual(asUser.status, 200);
    const asExternal = await call(await frontendTokenOf('external'), 'GET', '/requirements?limit=5');
    assert.strictEqual(asExternal.status, 403, 'a client user keeps its role: refused from internal requirements');
  });

  it('[626-AC-02] the machine token of @jiku/zitadel-auth (with the project id) is still accepted with its role', async () => {
    const response = await call(await machineTokenOf('jiku-api'), 'GET', '/requirements?limit=5');
    // Accepted (not 401) with its role `internal-app`, which does not read internal requirements.
    assert.strictEqual(response.status, 403, `answered ${response.status}: ${JSON.stringify(response.body)}`);
    assert.strictEqual((response.body as { code: string }).code, 'access_denied');
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

  it('a visitor with an unknown shared-document link gets the generic page, with no token', async () => {
    // Every cause (unknown, expired or revoked link) answers the same generic page. A well-formed
    // token the docs module does not know, on the public host.
    const unknown = `jds_unknown-${run}`.padEnd(47, '0').slice(0, 47);
    const response = await fetch(`${PUBLIC_URL}/p/docs/${unknown}`);
    assert.strictEqual(response.status, 404);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.match(await response.text(), /Este link no está disponible/);
  });

  it('a visitor opens a valid shared-document link and sees the document, with no token', async function () {
    // The api discovers the module through the JIKU_MODULES watch and checks it with a ping (and
    // re-checks every 30 s): right after `make up` it may still be `not_installed`. Poll, do not
    // sleep blindly. Every attempt counts against the 60/min rate limit of /p/docs, hence 3 s.
    this.timeout(75000);
    const deadline = Date.now() + 60000;
    let status = 0;
    let type = '';
    let page = '';
    for (;;) {
      const response = await fetch(`${PUBLIC_URL}/p/docs/${SHARE_TOKEN}`);
      status = response.status;
      type = response.headers.get('content-type') || '';
      page = await response.text();
      if (status === 200 || Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    assert.strictEqual(status, 200, `GET /p/docs/{token} answered ${status}: ${page.slice(0, 200)}`);
    assert.match(type, /text\/html/);
    assert.match(page, /<title>Documento compartido de prueba<\/title>/);
    assert.match(page, /Contenido servido por el módulo jiku-docs falso/);
  });

  it('an internal user lists requirements; a client user is refused', async () => {
    const asUser = await call(user, 'GET', '/requirements?limit=5');
    assert.strictEqual(asUser.status, 200);
    const asExternal = await call(external, 'GET', '/requirements?limit=5');
    assert.strictEqual(asExternal.status, 403);
  });
});
