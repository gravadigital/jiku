'use strict';

/*
 * Fake identity provider for local runs and end-to-end tests. It stands in for Zitadel at the
 * boundary: it serves the same endpoints the product uses, at the same paths, and signs tokens
 * with the same claims. Nothing of the product is mocked: api, core, web, opus-web and the NATS
 * auth-callout are pointed at it by configuration only.
 *
 *   GET  /.well-known/openid-configuration   discovery (issuer = FAKE_IDP_ISSUER)
 *   GET  /oauth/v2/keys                      JWKS
 *   GET  /oauth/v2/authorize                 code flow with PKCE; a page to pick the test user,
 *                                            or straight back with `login_hint=<user>`
 *   POST /oauth/v2/token                     authorization_code, and the jwt-bearer grant the
 *                                            machine users (api, core) use
 *   GET  /oidc/v1/userinfo                   profile of the token's subject
 *   GET  /oidc/v1/end_session                back to post_logout_redirect_uri
 *   GET  /test/token?user=<user>             a signed access token of a test user, for the
 *                                            end-to-end tests that enter as an HTTP or NATS client;
 *                                            `&variant=other-issuer` signs it (same key) with another
 *                                            issuer, `&variant=other-project` as a user of another
 *                                            project of the instance: that project in `aud` and in
 *                                            its roles claim, the same roles in the generic claim
 *   GET  /health                             liveness
 *
 * The users come from users.json. On start it writes, for each machine user, the key file in
 * Zitadel's format ({type, keyId, key, userId}) to FAKE_IDP_KEYS_DIR, which the services read
 * through ZITADEL_SERVICE_USER_KEY.
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.FAKE_IDP_PORT || 9400);
const ISSUER = (process.env.FAKE_IDP_ISSUER || `http://localhost:${PORT}`).replace(/\/$/, '');
const PROJECT_ID = process.env.FAKE_IDP_PROJECT_ID || 'jiku-project';
const ORG_ID = process.env.FAKE_IDP_ORG_ID || 'jiku-org';
// For the refusals of #626: another project of the same instance, and another issuer signing
// with the same key (an instance reached by another domain, or a copy of its keys).
const OTHER_PROJECT_ID = process.env.FAKE_IDP_OTHER_PROJECT_ID || 'other-project';
const OTHER_ISSUER = process.env.FAKE_IDP_OTHER_ISSUER || 'http://other-instance.localhost:9400';
// The scope a machine user adds to get the project in `aud` (and its roles claim), as in Zitadel.
const projectAudienceScope = (projectId) => `urn:zitadel:iam:org:project:id:${projectId}:aud`;
const KEYS_DIR = process.env.FAKE_IDP_KEYS_DIR || '/keys';
const TOKEN_TTL = Number(process.env.FAKE_IDP_TOKEN_TTL_SECONDS || 43200);
const USERS = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf8'));

const signing = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = crypto.randomBytes(8).toString('hex');
const codes = new Map();
const machineKeys = new Map();

const b64url = (value) => Buffer.from(value).toString('base64url');

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${body}`), signing.privateKey);
  return `${header}.${body}.${signature.toString('base64url')}`;
}

function decode(token) {
  const [header, body, signature] = String(token).split('.');
  if (!signature) throw new Error('not a JWT');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(body, 'base64url').toString()),
    signed: Buffer.from(`${header}.${body}`),
    signature: Buffer.from(signature, 'base64url'),
  };
}

function verifyOwn(token) {
  const jwt = decode(token);
  if (!crypto.verify('RSA-SHA256', jwt.signed, signing.publicKey, jwt.signature)) throw new Error('bad signature');
  if (jwt.payload.exp < Date.now() / 1000) throw new Error('expired');
  return jwt.payload;
}

function rolesClaim(user) {
  return Object.fromEntries(user.roles.map((role) => [role, { [ORG_ID]: 'jiku.test' }]));
}

function profile(user) {
  const out = { sub: user.sub, name: user.name, preferred_username: user.username };
  if (user.email) {
    out.email = user.email;
    out.email_verified = true;
  }
  return out;
}

/**
 * An access token as Zitadel signs it for a project: the project in `aud`, its roles in the
 * generic claim and in the project's claim. `options.project` = null is a token that did not ask
 * for any project audience (a machine user without the scope): no project in `aud`, only the
 * generic claim.
 */
function accessToken(user, clientId, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const roles = rolesClaim(user);
  const project = options.project === undefined ? PROJECT_ID : options.project;
  const audience = [clientId || project || user.username, project].filter((v, i, a) => v && a.indexOf(v) === i);
  return sign({
    iss: options.issuer || ISSUER,
    sub: user.sub,
    aud: audience,
    iat: now,
    nbf: now,
    exp: now + TOKEN_TTL,
    client_id: clientId || user.username,
    ...profile(user),
    'urn:zitadel:iam:org:project:roles': roles,
    ...(project ? { [`urn:zitadel:iam:org:project:${project}:roles`]: roles } : {}),
  });
}

function idToken(user, clientId, nonce) {
  const now = Math.floor(Date.now() / 1000);
  const roles = rolesClaim(user);
  return sign({
    iss: ISSUER,
    sub: user.sub,
    aud: [clientId, PROJECT_ID],
    azp: clientId,
    iat: now,
    exp: now + TOKEN_TTL,
    auth_time: now,
    ...(nonce ? { nonce } : {}),
    ...profile(user),
    'urn:zitadel:iam:org:project:roles': roles,
    [`urn:zitadel:iam:org:project:${PROJECT_ID}:roles`]: roles,
  });
}

function writeMachineKeys() {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  for (const user of USERS.filter((u) => u.machine)) {
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const keyId = crypto.randomBytes(8).toString('hex');
    machineKeys.set(keyId, { user, publicKey: pair.publicKey });
    const file = {
      type: 'serviceaccount',
      keyId,
      key: pair.privateKey.export({ type: 'pkcs1', format: 'pem' }),
      userId: user.sub,
    };
    fs.writeFileSync(path.join(KEYS_DIR, `${user.username}.json`), JSON.stringify(file, null, 2), { mode: 0o644 });
  }
}

const findUser = (hint) => USERS.find((u) => !u.machine && (u.username === hint || u.sub === hint || u.email === hint));

function send(res, status, body, headers = {}) {
  const json = typeof body !== 'string';
  res.writeHead(status, {
    'Content-Type': json ? 'application/json' : 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
  res.end(json ? JSON.stringify(body) : body);
}

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function loginPage(params) {
  const rows = USERS.filter((u) => !u.machine)
    .map((u) => {
      const q = new URLSearchParams({ ...params, login_hint: u.username });
      return `<li><a data-user="${escape(u.username)}" href="/oauth/v2/authorize?${escape(q.toString())}">${escape(u.name)}</a> <small>${escape(u.roles.join(', '))}</small></li>`;
    })
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Fake IdP</title></head>
<body><h1>Ingresar como</h1><p>Proveedor de identidad falso, solo para desarrollo y pruebas.</p><ul>${rows}</ul></body></html>`;
}

function authorize(url, res) {
  const params = Object.fromEntries(url.searchParams);
  if (!params.redirect_uri || !params.client_id) return send(res, 400, { error: 'invalid_request' });
  const user = params.login_hint && findUser(params.login_hint);
  if (!user) return send(res, 200, loginPage(params));
  const code = crypto.randomBytes(24).toString('base64url');
  codes.set(code, {
    user,
    clientId: params.client_id,
    redirectUri: params.redirect_uri,
    challenge: params.code_challenge,
    method: params.code_challenge_method || 'plain',
    nonce: params.nonce,
    expires: Date.now() + 120000,
  });
  const target = new URL(params.redirect_uri);
  target.searchParams.set('code', code);
  if (params.state) target.searchParams.set('state', params.state);
  res.writeHead(302, { Location: target.toString() });
  res.end();
}

function clientIdFrom(req, form) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Basic ')) return decodeURIComponent(Buffer.from(auth.slice(6), 'base64').toString().split(':')[0]);
  return form.get('client_id');
}

function token(req, form, res) {
  const grant = form.get('grant_type');
  if (grant === 'authorization_code') {
    const entry = codes.get(form.get('code'));
    codes.delete(form.get('code'));
    if (!entry || entry.expires < Date.now()) return send(res, 400, { error: 'invalid_grant' });
    if (form.get('redirect_uri') && form.get('redirect_uri') !== entry.redirectUri) return send(res, 400, { error: 'invalid_grant' });
    if (entry.challenge) {
      const verifier = form.get('code_verifier') || '';
      const computed = entry.method === 'S256' ? crypto.createHash('sha256').update(verifier).digest('base64url') : verifier;
      if (computed !== entry.challenge) return send(res, 400, { error: 'invalid_grant', error_description: 'PKCE' });
    }
    const clientId = clientIdFrom(req, form) || entry.clientId;
    return send(res, 200, {
      access_token: accessToken(entry.user, clientId),
      id_token: idToken(entry.user, clientId, entry.nonce),
      token_type: 'Bearer',
      expires_in: TOKEN_TTL,
    });
  }
  if (grant === 'urn:ietf:params:oauth:grant-type:jwt-bearer') {
    try {
      const assertion = decode(form.get('assertion'));
      const machine = machineKeys.get(assertion.header.kid);
      if (!machine || !crypto.verify('RSA-SHA256', assertion.signed, machine.publicKey, assertion.signature)) {
        return send(res, 400, { error: 'invalid_grant', error_description: 'unknown key' });
      }
      // As Zitadel: the project goes in `aud` only when the scope asks for its audience.
      const scopes = (form.get('scope') || '').split(/\s+/);
      const project = scopes.includes(projectAudienceScope(PROJECT_ID)) ? PROJECT_ID : null;
      return send(res, 200, { access_token: accessToken(machine.user, undefined, { project }), token_type: 'Bearer', expires_in: TOKEN_TTL });
    } catch (error) {
      return send(res, 400, { error: 'invalid_grant', error_description: error.message });
    }
  }
  return send(res, 400, { error: 'unsupported_grant_type' });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ISSUER);
  const local = `http://${req.headers.host}`;
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'up' });
    if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
      return send(res, 200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/oauth/v2/authorize`,
        end_session_endpoint: `${ISSUER}/oidc/v1/end_session`,
        // Server-to-server endpoints answer at the address the caller used, so a container can
        // reach them by its service name while the browser uses the public issuer.
        token_endpoint: `${local}/oauth/v2/token`,
        jwks_uri: `${local}/oauth/v2/keys`,
        userinfo_endpoint: `${local}/oidc/v1/userinfo`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256', 'plain'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
        scopes_supported: ['openid', 'profile', 'email'],
      });
    }
    if (req.method === 'GET' && url.pathname === '/oauth/v2/keys') {
      const jwk = signing.publicKey.export({ format: 'jwk' });
      return send(res, 200, { keys: [{ ...jwk, kid: KID, use: 'sig', alg: 'RS256' }] });
    }
    if (req.method === 'GET' && url.pathname === '/oauth/v2/authorize') return authorize(url, res);
    if (req.method === 'POST' && url.pathname === '/oauth/v2/token') {
      return token(req, new URLSearchParams(await readBody(req)), res);
    }
    if (url.pathname === '/oidc/v1/userinfo') {
      const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
      const claims = verifyOwn(bearer);
      const user = USERS.find((u) => u.sub === claims.sub);
      if (!user) return send(res, 401, { error: 'invalid_token' });
      const roles = rolesClaim(user);
      return send(res, 200, {
        ...profile(user),
        'urn:zitadel:iam:org:project:roles': roles,
        [`urn:zitadel:iam:org:project:${PROJECT_ID}:roles`]: roles,
      });
    }
    if (req.method === 'GET' && url.pathname === '/oidc/v1/end_session') {
      const back = url.searchParams.get('post_logout_redirect_uri');
      res.writeHead(back ? 302 : 200, back ? { Location: back } : {});
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/test/token') {
      const user = USERS.find((u) => u.username === url.searchParams.get('user') || u.sub === url.searchParams.get('user'));
      if (!user) return send(res, 404, { error: 'unknown_user' });
      const variant = url.searchParams.get('variant');
      const options = { 'other-issuer': { issuer: OTHER_ISSUER }, 'other-project': { project: OTHER_PROJECT_ID } }[variant || ''];
      if (variant && !options) return send(res, 400, { error: 'unknown_variant' });
      return send(res, 200, { access_token: accessToken(user, url.searchParams.get('client_id'), options), sub: user.sub, token_type: 'Bearer', expires_in: TOKEN_TTL });
    }
    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    return send(res, 401, { error: 'invalid_token', error_description: error.message });
  }
});

writeMachineKeys();
server.listen(PORT, () => console.log(`fake-idp: issuer ${ISSUER}, listening on ${PORT}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
