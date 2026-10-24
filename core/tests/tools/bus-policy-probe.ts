/**
 * Sonda de la política del bus (S-075, Task 6, CA-9 a CA-13).
 *
 * ES UNA HERRAMIENTA DE VERIFICACIÓN, NO PARTE DEL PRODUCTO. Se conecta COMO LAS IDENTIDADES
 * REALES (sentinel + token de Zitadel + `inboxPrefix`, igual que `core/src/bus/host.ts`) y
 * ejecuta la matriz de probes de un perfil, cada uno con su expectativa (allow/deny). El
 * oráculo definitivo es el log del servidor NATS: el lanzador (`deploy/nats/bus-policy-probe.sh`)
 * cuenta las líneas `Violation` antes y después. Acá la detección es la del lado del cliente.
 *
 * `console.log` ES CORRECTO ACÁ: el producto de una herramienta de CLI es su salida.
 * No importa nada de `core/src/`. Vive en `tests/tools/` para que `tsconfig.json` la typechequee.
 *
 * Variables: NATS_URL, NATS_CREDS (sentinel-client.creds), ZITADEL_SERVICE_USER_KEY,
 * ZITADEL_ISSUER_URL, ZITADEL_PROJECT_ID. Uso:
 *   bus-policy-probe.ts --profile <docs|connector|person-internal|person-external> [--key <json>]
 */
import { readFileSync } from 'fs';
import { connect, credsAuthenticator, tokenAuthenticator, NatsConnection } from 'nats';
import { INSTANCE, inboxPrefix } from '@jiku/nats-protocol';
import { ZitadelServiceUser, serviceUserKeyFromEnv, ServiceUserKey } from '@jiku/zitadel-auth';

type Profile = 'docs' | 'connector' | 'person-internal' | 'person-external';
type Expect = 'allow' | 'deny';
type Kind = 'pub' | 'sub' | 'kv' | 'js';

interface Probe {
  kind: Kind;
  subject: string;
  expected: Expect;
  run: (nc: NatsConnection) => Promise<void>;
}

const KV_BUCKET = 'JIKU_MODULES';
const SETTLE_MS = 1500;

function parseArgs(argv: string[]): { profile: Profile; key?: string } {
  const out: { profile?: Profile; key?: string } = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--profile') out.profile = argv[i + 1] as Profile;
    else if (argv[i] === '--key') out.key = argv[i + 1];
    else throw new Error(`argumento desconocido: ${argv[i]}`);
  }
  if (!out.profile || !['docs', 'connector', 'person-internal', 'person-external'].includes(out.profile)) {
    throw new Error('uso: bus-policy-probe.ts --profile <docs|connector|person-internal|person-external> [--key <json>]');
  }
  return { profile: out.profile, key: out.key };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Publica y hace flush: un `no responders` no es una violación, así que no se usa request. */
const pub = (subject: string, expected: Expect): Probe => ({
  kind: 'pub',
  subject,
  expected,
  run: async (nc) => {
    nc.publish(subject, '{}');
    await nc.flush();
  },
});

const sub = (subject: string, expected: Expect, queue?: string): Probe => ({
  kind: 'sub',
  subject,
  expected,
  run: async (nc) => {
    const s = nc.subscribe(subject, queue ? { queue } : undefined);
    await nc.flush();
    await sleep(SETTLE_MS);
    s.unsubscribe();
  },
});

const kvGet = (expected: Expect): Probe => ({
  kind: 'kv',
  subject: `kv.get ${KV_BUCKET}`,
  expected,
  run: async (nc) => {
    const kv = await nc.jetstream().views.kv(KV_BUCKET, { bindOnly: true });
    await kv.get('docs');
  },
});

const kvWatch = (expected: Expect): Probe => ({
  kind: 'kv',
  subject: `kv.watch ${KV_BUCKET}`,
  expected,
  run: async (nc) => {
    const kv = await nc.jetstream().views.kv(KV_BUCKET);
    const watch = await kv.watch();
    await sleep(SETTLE_MS);
    watch.stop();
  },
});

const kvPut = (key: string, expected: Expect): Probe => ({
  kind: 'kv',
  subject: `$KV.${KV_BUCKET}.${key}`,
  expected,
  run: async (nc) => {
    const kv = await nc.jetstream().views.kv(KV_BUCKET, { bindOnly: true });
    await kv.put(key, JSON.stringify({ module: key, serviceName: 'jiku-docs', protocol: 'v1' }));
  },
});

const ping = (): Probe => ({
  kind: 'pub',
  subject: '$SRV.PING.jiku-docs-queries',
  expected: 'allow',
  run: async (nc) => {
    try {
      await nc.request('$SRV.PING.jiku-docs-queries', '', { timeout: 1000 });
    } catch {
      // timeout o no responders: tolerado, no es una violación.
    }
  },
});

const jsStreamInfo = (stream: string, expected: Expect): Probe => ({
  kind: 'js',
  subject: `$JS.API.STREAM.INFO.${stream}`,
  expected,
  run: async (nc) => {
    const jsm = await nc.jetstreamManager();
    await jsm.streams.info(stream);
  },
});

function probesFor(profile: Profile, userId: string): Probe[] {
  const mine = (svc: string, method: string) => `${INSTANCE}.${userId}.${svc}.v1.${method}`;
  const other = (svc: string, method: string) => `${INSTANCE}.0000000000000000000.${svc}.v1.${method}`;
  switch (profile) {
    case 'docs':
      return [
        sub(`${INSTANCE}.*.jiku-docs-commands.v1.>`, 'allow', 'jiku-docs'),
        sub(`${INSTANCE}.*.jiku-docs-queries.v1.>`, 'allow', 'jiku-docs'),
        sub('$SRV.>', 'allow'),
        pub(`${INSTANCE}.docs-events.v1.document.updated`, 'allow'),
        pub(`${INSTANCE}.${userId}.docs-notify.v1.document.updated`, 'allow'),
        kvPut('docs', 'allow'),
        jsStreamInfo('JIKU_DOCS_EVENTS', 'allow'),
        pub(mine('jiku-queries', 'users.list'), 'allow'),
        kvPut('otro', 'deny'),
      ];
    case 'connector':
      return [
        pub(mine('jiku-docs-commands', 'documents.new'), 'allow'),
        pub(mine('jiku-docs-queries', 'documents.list'), 'allow'),
        ping(),
        kvGet('allow'),
        kvWatch('allow'),
        sub(`${INSTANCE}.*.jiku-docs-queries.v1.>`, 'deny'),
        pub(`${INSTANCE}.docs-events.v1.document.updated`, 'deny'),
        pub(`$KV.${KV_BUCKET}.docs`, 'deny'),
      ];
    case 'person-internal':
      return [
        pub(mine('jiku-docs-commands', 'documents.new'), 'allow'),
        pub(other('jiku-docs-commands', 'documents.new'), 'deny'),
        sub(`${INSTANCE}.${userId}.docs-notify.v1.>`, 'allow'),
        kvGet('allow'),
      ];
    case 'person-external':
      return [
        pub(mine('jiku-docs-queries', 'documents.list'), 'allow'),
        pub(mine('jiku-docs-commands', 'documents.new'), 'deny'),
        sub(`${INSTANCE}.${userId}.docs-notify.v1.>`, 'deny'),
        kvGet('allow'),
      ];
  }
}

async function main(): Promise<void> {
  const { profile, key } = parseArgs(process.argv.slice(2));
  const servers = process.env.NATS_URL || 'nats://localhost:4222';
  const credsPath = process.env.NATS_CREDS;
  const issuer = process.env.ZITADEL_ISSUER_URL;
  if (key) process.env.ZITADEL_SERVICE_USER_KEY = key;
  const keyJson: ServiceUserKey | null = serviceUserKeyFromEnv();
  if (!keyJson || !issuer) {
    throw new Error('faltan ZITADEL_SERVICE_USER_KEY (o --key) y ZITADEL_ISSUER_URL');
  }
  const serviceUser = new ZitadelServiceUser({ key: keyJson, issuer, projectId: process.env.ZITADEL_PROJECT_ID });
  await serviceUser.token();

  const userId = keyJson.userId;
  const nc = await connect({
    servers,
    inboxPrefix: inboxPrefix(userId),
    authenticator: [
      ...(credsPath ? [credsAuthenticator(readFileSync(credsPath))] : []),
      tokenAuthenticator(() => serviceUser.currentToken()),
    ],
    name: `bus-policy-probe-${profile}`,
  });

  // Las violaciones llegan como errores asíncronos del estado de la conexión; se capturan para
  // que no tiren el proceso y se atribuyen al probe que corría cuando llegaron.
  let violations: string[] = [];
  void (async () => {
    for await (const status of nc.status()) {
      if (status.type === 'error') violations.push(String((status as unknown as { error: unknown }).error));
    }
  })();

  let failed = 0;
  for (const probe of probesFor(profile, userId)) {
    violations = [];
    let threw: string | null = null;
    try {
      await probe.run(nc);
      await nc.flush();
      await sleep(300);
    } catch (error) {
      threw = (error as Error).message;
    }
    const denied = violations.length > 0 || (threw !== null && /permission|violation/i.test(threw));
    const got: Expect = denied ? 'deny' : 'allow';
    const ok = got === probe.expected;
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'}  ${probe.kind}  ${probe.subject}  expected=${probe.expected}`);
    if (!ok) console.log(`      got=${got} ${violations.join(' | ')} ${threw ?? ''}`);
  }

  await nc.drain();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
