'use strict';

/*
 * Fake jiku-docs module for the local stack and the end-to-end tests. jiku-docs is an OPTIONAL
 * external module (not in this repository); this stands in for it at the bus boundary, the way
 * fake-idp stands in for Zitadel. Nothing of the product is mocked: the api discovers it and calls
 * it exactly as it would the real module.
 *
 * What it does, as the real module would:
 *   - connects to NATS as the machine user `jiku-docs` (role `docs` -> auth-callout template
 *     docs.yaml): a token from the identity provider with the jwt-bearer grant, the sentinel creds
 *     and the inbox prefix the callout authorizes (`_INBOX.<hash(sub)>`);
 *   - serves the NATS micro services `jiku-docs-queries` and `jiku-docs-commands` on
 *     `{instance}.*.jiku-docs-{queries|commands}.v1.>` (they answer `$SRV.PING`, which is how the api
 *     tells whether the module is alive);
 *   - registers itself in the JetStream KV `JIKU_MODULES`, key `docs`
 *     (_jflow/apis/jiku-modules.asyncapi.yaml).
 *
 * What it answers (no persistence):
 *   - `shares.resolve` with FAKE_DOCS_SHARE_TOKEN: one fixed shared document;
 *   - `shares.resolve` with any other token: `share_not_found`;
 *   - the list and search queries the frontends make while rendering: an empty, valid reply;
 *   - `documents.get` / `folders.get`: `document_not_found` / `folder_not_found`;
 *   - every other method, and every command (writes): `internal_error` (the api answers it as a
 *     module error; nothing crashes).
 */
const crypto = require('crypto');
const fs = require('fs');
const { connect, credsAuthenticator, tokenAuthenticator, JSONCodec } = require('nats');

const NATS_URL = process.env.NATS_URL || 'nats://nats:4222';
const NATS_CREDS = process.env.NATS_CREDS;
const INSTANCE = process.env.NATS_INSTANCE || 'local';
const ISSUER = (process.env.ZITADEL_ISSUER_URL || 'http://fake-idp:9400').replace(/\/$/, '');
const PROJECT_ID = process.env.ZITADEL_PROJECT_ID || 'jiku-project';
const KEY_FILE = process.env.ZITADEL_SERVICE_USER_KEY || '/idp-keys/jiku-docs.json';
const SERVICE_NAME = 'jiku-docs';
const PROTOCOL = 'v1';
// Must match the api's SHARE_TOKEN_PATTERN (/^jds_[A-Za-z0-9_-]{43}$/), or the api answers the
// generic 404 before reaching the bus.
const SHARE_TOKEN = process.env.FAKE_DOCS_SHARE_TOKEN || 'jds_e2e-shared-document-00000000000000000000000';
const DOCUMENT = {
  shareId: 'fake-share-1',
  documentId: 'fake-document-1',
  title: process.env.FAKE_DOCS_TITLE || 'Documento compartido de prueba',
  version: 1,
  html: '<h1>Documento compartido de prueba</h1><p>Contenido servido por el módulo jiku-docs falso.</p>',
};

const log = (message) => console.log(`fake-docs: ${message}`);
const jc = JSONCodec();
const b64url = (value) => Buffer.from(value).toString('base64url');

/** sha256, base32 (RFC 4648, no padding), lowercase, first 16 chars: same as the callout. */
function inboxPrefix(userId) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of crypto.createHash('sha256').update(userId).digest()) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return `_INBOX.${out.slice(0, 16).toLowerCase()}`;
}

/** jwt-bearer grant, like packages/zitadel-auth. */
async function fetchToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', kid: key.keyId }));
  const payload = b64url(JSON.stringify({ iss: key.userId, sub: key.userId, aud: ISSUER, iat: now, exp: now + 300 }));
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key.key);
  const response = await fetch(`${ISSUER}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      // The project audience: the auth-callout refuses a token without it (#626, DEC-T35).
      scope: `openid profile urn:zitadel:iam:org:projects:roles urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud`,
      assertion: `${header}.${payload}.${b64url(signature)}`,
    }),
  });
  if (!response.ok) throw new Error(`token endpoint answered ${response.status}`);
  const body = await response.json();
  return { token: body.access_token, expiresIn: body.expires_in || 3600 };
}

const success = (data) => ({ status: 'success', data });
const failure = (errorCode, errorMessage) => ({ status: 'failure', errorCode, errorMessage });

// Reads the frontends do while rendering their screens (documents, folders, topics, shares,
// versions): an empty page, `{ items, page: { limit, returned } }` (DocsPageInfo in api.openapi.yaml).
const LIST_METHODS = new Set(['documents.list', 'folders.list', 'topics.list', 'shares.list', 'documents.versions.list']);

function emptyPage(body) {
  const requested = body && body.page && Number(body.page.limit);
  const page = { limit: requested > 0 ? requested : 50, returned: 0 };
  if (body && body.count === true) page.total = 0;
  return success({ items: [], page });
}

function answerQuery(method, body) {
  if (method === 'shares.resolve') {
    return body && body.token === SHARE_TOKEN ? success(DOCUMENT) : failure('share_not_found', 'Share not found');
  }
  if (LIST_METHODS.has(method)) return emptyPage(body);
  // No `page` in these two (DocsSearchResponse and the suggested relations).
  if (method === 'documents.search' || method === 'documents.suggest-relations') return success({ items: [] });
  // There is nothing to read: the not-found codes the api maps to 404.
  if (method === 'documents.get') return failure('document_not_found', 'Document not found');
  if (method === 'folders.get') return failure('folder_not_found', 'Folder not found');
  return failure('internal_error', `fake jiku-docs does not implement ${method}`);
}

function addService(nc, kind, answer) {
  return nc.services
    .add({ name: `${SERVICE_NAME}-${kind}`, version: '1.0.0', description: `fake jiku-docs ${kind}` })
    .then((service) => {
      service.addEndpoint('all', {
        subject: `${INSTANCE}.*.${SERVICE_NAME}-${kind}.${PROTOCOL}.>`,
        handler: (error, msg) => {
          if (error) return log(`${kind} endpoint error: ${error.message}`);
          const method = msg.subject.split('.').slice(4).join('.');
          let body = null;
          try {
            body = msg.data.length ? jc.decode(msg.data) : null;
          } catch {
            return msg.respond(jc.encode(failure('invalid_fields', 'Invalid JSON')));
          }
          // The token is never logged, as the real module would not.
          log(`${kind} ${method}`);
          msg.respond(jc.encode(answer(method, body)));
        },
      });
      return service;
    });
}

async function waitForKey() {
  for (;;) {
    try {
      return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
    } catch {
      log(`waiting for ${KEY_FILE}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function main() {
  const key = await waitForKey();
  let current = await fetchToken(key);
  // fake-idp tokens last hours; renew at half life so a reconnection never presents an expired one.
  setInterval(async () => {
    try {
      current = await fetchToken(key);
    } catch (error) {
      log(`could not renew the token: ${error.message}`);
    }
  }, Math.max(60, current.expiresIn / 2) * 1000).unref();

  const nc = await connect({
    servers: NATS_URL,
    name: 'fake-jiku-docs',
    inboxPrefix: inboxPrefix(key.userId),
    authenticator: [
      ...(NATS_CREDS ? [credsAuthenticator(fs.readFileSync(NATS_CREDS))] : []),
      tokenAuthenticator(() => current.token),
    ],
    maxReconnectAttempts: -1,
  });
  log(`connected to ${NATS_URL} as ${key.userId}`);
  (async () => {
    for await (const status of nc.status()) log(`nats ${status.type}${status.data ? ` ${JSON.stringify(status.data)}` : ''}`);
  })();

  await addService(nc, 'queries', answerQuery);
  await addService(nc, 'commands', (method) => failure('internal_error', `fake jiku-docs does not implement ${method}`));

  // Registered AFTER the services exist, so the api's first ping already finds them.
  const kv = await nc.jetstream().views.kv('JIKU_MODULES', { bindOnly: true, allow_direct: true });
  const record = { module: 'docs', serviceName: SERVICE_NAME, protocol: PROTOCOL, registeredAt: new Date().toISOString() };
  await kv.put('docs', JSON.stringify(record));
  log(`registered in JIKU_MODULES: ${JSON.stringify(record)}`);

  const stop = async () => {
    // A normal shutdown does not remove the key (contract): the api sees the module `unavailable`.
    await nc.drain().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  await nc.closed();
}

main().catch((error) => {
  console.error(`fake-docs: ${error.message}`);
  process.exit(1);
});
