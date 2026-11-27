/**
 * End to end of core's NATS interface, against the broker of `make up`.
 *
 * It enters as a client of the bus does: it connects with the sentinel credentials plus the
 * actor's access token (signed by the fake identity provider), the auth-callout validates the
 * token and grants the subjects of the actor's role, and core answers the request.
 *
 * NATS_URL, IDP_URL and NATS_INSTANCE point elsewhere when needed (defaults: `make up`).
 */
import assert from 'assert';
import { execFileSync } from 'child_process';
import path from 'path';
import { connect, credsAuthenticator, tokenAuthenticator, NatsConnection } from 'nats';
import { inboxPrefix } from '@jiku/nats-protocol';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const IDP_URL = (process.env.IDP_URL || 'http://localhost:9400').replace(/\/$/, '');
const INSTANCE = process.env.NATS_INSTANCE || 'local';
const ROOT = path.join(__dirname, '..', '..', '..');

/** The sentinel credentials live in the `nats-creds` volume of the local stack. */
function sentinelCreds(): Uint8Array {
  const out = execFileSync(
    'docker',
    ['compose', '-f', path.join(ROOT, 'docker-compose.yml'), 'run', '--rm', '--no-deps', '-T',
      '--entrypoint', 'cat', 'nats-identity', '/nats/creds/sentinel-client.creds'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }
  );
  return new Uint8Array(out);
}

async function tokenOf(user: string): Promise<{ token: string; sub: string }> {
  const response = await fetch(`${IDP_URL}/test/token?user=${user}`);
  assert.strictEqual(response.status, 200);
  const body = (await response.json()) as { access_token: string; sub: string };
  return { token: body.access_token, sub: body.sub };
}

async function connectAs(user: string): Promise<{ nc: NatsConnection; sub: string }> {
  const { token, sub } = await tokenOf(user);
  const nc = await connect({
    servers: NATS_URL,
    authenticator: [credsAuthenticator(sentinelCreds()), tokenAuthenticator(token)],
    // The callout only lets each identity subscribe to its own inbox (a hash of its user id).
    inboxPrefix: inboxPrefix(sub),
  });
  return { nc, sub };
}

/**
 * Core learns a direct caller's roles from the authentication event the callout publishes when
 * the caller connects, so the first request may arrive before that: it is retried briefly.
 */
async function query(nc: NatsConnection, sub: string, name: string, payload: unknown) {
  const subject = `${INSTANCE}.${sub}.jiku-queries.v1.${name}`;
  let last: any;
  for (let attempt = 0; attempt < 20; attempt++) {
    const message = await nc.request(subject, new TextEncoder().encode(JSON.stringify(payload)), { timeout: 5000 });
    last = JSON.parse(new TextDecoder().decode(message.data));
    if (last.errorCode !== 'unknown_caller') return last;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return last;
}

describe('core NATS — end to end against make up', () => {
  it('an internal user, authenticated by the auth-callout, queries the projects', async () => {
    const { nc, sub } = await connectAs('user');
    try {
      const reply = await query(nc, sub, 'projects.list', {});
      assert.strictEqual(reply.status, 'success', JSON.stringify(reply));
    } finally {
      await nc.close();
    }
  });

  it('a caller cannot publish under another identity', async () => {
    const { nc } = await connectAs('external');
    try {
      const other = `${INSTANCE}.300000000000000001.jiku-queries.v1.projects.list`;
      await assert.rejects(
        nc.request(other, new TextEncoder().encode('{}'), { timeout: 3000 }),
        'a request on a subject of another user is not delivered'
      );
    } finally {
      await nc.close();
    }
  });
});
