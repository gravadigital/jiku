/**
 * Consumidor de prueba de eventos de dominio (S-067, Task 5, CA-3, CA-4).
 *
 * ES UNA HERRAMIENTA DE VERIFICACIÓN, NO UN CONECTOR PRODUCTIVO. El conector real se
 * desarrolla FUERA de este repositorio (REQ-014). Esto es lo que queda ACÁ como forma de
 * comprobar, contra un NATS/JetStream real, que:
 *   1. Los permisos del molde `deploy/nats/auth-callout/templates/connector.yaml` alcanzan
 *      (D-6: el lanzador `.sh` mintea su credencial con los MISMOS tres permisos).
 *   2. El transporte entrega subject, versión y payload completo tal como
 *      `docs/apis/core-events.yaml` los declara — lo único que un doble (`FakeEventPublisher`)
 *      no puede probar.
 *   3. La retención de 7 días se comporta como el contrato dice (CA-5, manual, ver el `usage`).
 *
 * `console.log` ES CORRECTO ACÁ, a diferencia de `core/src/`: es una herramienta de línea de
 * comandos cuyo PRODUCTO es la salida por consola — no hay a quién más informarle el reporte.
 *
 * VIVE EN `tests/tools/` Y NO EN UN `core/scripts/` NUEVO: `tsconfig.json` incluye
 * `tests/**‍/*.ts` con `rootDir: "./"`, así que este archivo se typechequea con `npm run build`.
 * Un archivo puesto fuera de `include` no lo compila nadie y se pudre en silencio.
 *
 * NO LO IMPORTA NADA DE `core/src/`: comparte el validador de contrato con la suite de tests
 * (`../helpers/events-contract`), no el emisor de producción.
 */
import { readFileSync } from 'fs';
import { AckPolicy, DeliverPolicy, connect, credsAuthenticator } from 'nats';
import { EVENT_TYPES, eventsStreamSubject } from '@jiku/nats-protocol';
import { assertContract } from '../helpers/events-contract';

const STREAM_NAME = 'JIKU_EVENTS';
const DEFAULT_DURABLE = 'events-test-consumer';
const DEFAULT_TIMEOUT_SECONDS = 60;

interface Options {
  natsUrl: string;
  creds: string;
  durable: string;
  fromStart: boolean;
  timeoutSeconds: number;
}

function usage(): void {
  // eslint-disable-next-line no-console
  console.log(`
uso: events-test-consumer.ts [opciones]

Consumidor de prueba del stream de eventos de dominio JIKU_EVENTS (S-067, CA-3). Es una
HERRAMIENTA DE VERIFICACIÓN que vive en el repositorio — NO es el conector productivo, que
se desarrolla FUERA de Jiku (REQ-014).

Crea (o re-usa) un durable JetStream con filter_subject = eventsStreamSubject(), valida
CADA mensaje recibido contra docs/apis/core-events.yaml (el MISMO validador que usa la
suite de tests de core) y, al terminar, imprime un reporte de cobertura de los 16 tipos
del catálogo.

Opciones:
  --nats-url <url>       default: NATS_URL, si no nats://localhost:4222
  --creds <archivo>      default: NATS_CREDS. Obligatorio (de una forma u otra).
  --durable <nombre>     default: ${DEFAULT_DURABLE}
  --from-start           pide TODO lo que quede en el stream (deliver_policy=all).
                         Sin esta opción solo se reciben eventos NUEVOS (deliver_policy=new)
                         — el uso normal es "arranco el consumidor y después corro comandos".
  --timeout <segundos>   default: ${DEFAULT_TIMEOUT_SECONDS}. Corta la corrida e imprime el reporte.
  --help                 imprime esta ayuda y termina (exit 0).

Exit code: 0 solo si TODO lo recibido fue válido contra el contrato. Distinto de 0 si algún
mensaje falló la validación. Que falten tipos NO es, por sí solo, un fallo — el operador
puede estar ejercitando solo una parte — pero el reporte lo dice igual.

Receta del experimento de CA-5 (pérdida por retención tras 7 días) — DESTRUCTIVO, SOLO EN
UN ENTORNO DE PRUEBA, nunca en producción:

  nats stream update JIKU_EVENTS --max-age 10s --force   # baja la retención a 10 segundos
  # publicar uno o más comandos que emitan eventos
  # esperar 15 segundos (más que el max_age nuevo)
  ts-node events-test-consumer.ts --from-start --creds <...>
  # el consumidor NO recibe los eventos vencidos, y NO HAY FORMA DE SABER CUÁLES FUERON:
  # es el comportamiento DECLARADO y esperado de docs/apis/core-events.yaml, no un bug.
`);
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
    creds: process.env.NATS_CREDS || '',
    durable: DEFAULT_DURABLE,
    fromStart: false,
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--nats-url':
        opts.natsUrl = argv[++i];
        break;
      case '--creds':
        opts.creds = argv[++i];
        break;
      case '--durable':
        opts.durable = argv[++i];
        break;
      case '--from-start':
        opts.fromStart = true;
        break;
      case '--timeout':
        opts.timeoutSeconds = Number(argv[++i]);
        break;
      default:
        throw new Error(`opción desconocida: ${arg}`);
    }
  }

  return opts;
}

interface TypeCounts {
  valid: number;
  invalid: number;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    usage();
    process.exitCode = 0;
    return;
  }

  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[events-test-consumer] ${(error as Error).message}`);
    usage();
    process.exitCode = 1;
    return;
  }

  if (!opts.creds) {
    // eslint-disable-next-line no-console
    console.error(
      '[events-test-consumer] falta la credencial: pasá --creds <archivo> o fijá NATS_CREDS.'
    );
    process.exitCode = 1;
    return;
  }

  const connection = await connect({
    servers: opts.natsUrl,
    authenticator: credsAuthenticator(readFileSync(opts.creds)),
  });

  const jsm = await connection.jetstreamManager();

  // Si el stream no existe, el fallo tiene que NOMBRAR el script que lo crea (TS-37) — no
  // dejar escapar el error crudo de JetStream, que hablaría de "stream not found" sin decir
  // qué hacer al respecto.
  try {
    await jsm.streams.info(STREAM_NAME);
  } catch {
    // eslint-disable-next-line no-console
    console.error(`[events-test-consumer] el stream ${STREAM_NAME} no existe todavía.`);
    // eslint-disable-next-line no-console
    console.error('Creálo primero con: ./deploy/nats/create-events-stream.sh');
    await connection.close();
    process.exitCode = 1;
    return;
  }

  // El durable, con filter_subject = eventsStreamSubject() — NUNCA un subject armado a mano
  // (AC-6 de la Task 5): es el mismo helper que usa el emisor de `core` y el gate de
  // `connector.yaml`, así que los tres no pueden divergir.
  await jsm.consumers.add(STREAM_NAME, {
    durable_name: opts.durable,
    filter_subject: eventsStreamSubject(),
    ack_policy: AckPolicy.Explicit,
    // `New` por default (no `All`): el uso normal es "arranco el consumidor y después
    // ejecuto los comandos". `--from-start` es lo que hace falta para el experimento de
    // retención de CA-5, donde justamente hay que pedir todo lo que quede.
    deliver_policy: opts.fromStart ? DeliverPolicy.All : DeliverPolicy.New,
  });

  const js = connection.jetstream();
  const consumer = await js.consumers.get(STREAM_NAME, opts.durable);
  const messages = await consumer.consume();

  // Deduplicar por eventId (at-least-once, la garantía de entrega del contrato): un
  // redelivery no debe contarse dos veces, y menos inflar el conteo de inválidos.
  const seenEventIds = new Set<string>();
  const byType = new Map<string, TypeCounts>();

  const timer = setTimeout(() => {
    messages.stop();
  }, opts.timeoutSeconds * 1000);

  for await (const msg of messages) {
    let payload: { eventId?: string; type?: string } | undefined;
    try {
      payload = JSON.parse(Buffer.from(msg.data).toString('utf-8'));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(
        `[events-test-consumer] mensaje NO-JSON en ${msg.subject}: ${(error as Error).message}`
      );
      // ACK SIEMPRE, también con un payload ilegible: lo que se verifica es el contrato, no
      // el reintento. Un nak() lo redeliveraría en loop.
      msg.ack();
      continue;
    }

    const eventId = payload?.eventId;
    const type = payload?.type ?? '(sin type)';

    if (eventId && seenEventIds.has(eventId)) {
      msg.ack();
      continue;
    }

    let valid = true;
    let failureMessage = '';
    try {
      assertContract({ subject: msg.subject, payload });
    } catch (error) {
      valid = false;
      failureMessage = (error as Error).message;
    }

    if (eventId) {
      seenEventIds.add(eventId);
    }

    const counts = byType.get(type) ?? { valid: 0, invalid: 0 };
    if (valid) {
      counts.valid += 1;
    } else {
      counts.invalid += 1;
    }
    byType.set(type, counts);

    // eslint-disable-next-line no-console
    console.log(
      `[events-test-consumer] type=${type} eventId=${eventId ?? '(sin eventId)'} `
        + (valid ? 'OK' : `INVALID: ${failureMessage}`)
    );

    msg.ack();
  }

  clearTimeout(timer);

  // eslint-disable-next-line no-console
  console.log('\n[events-test-consumer] reporte de cobertura del catálogo (16 tipos):');
  let anyInvalid = false;
  for (const type of Object.values(EVENT_TYPES)) {
    const counts = byType.get(type);
    if (!counts) {
      // eslint-disable-next-line no-console
      console.log(`  ${type}: NO LLEGÓ`);
    } else if (counts.invalid > 0) {
      anyInvalid = true;
      // eslint-disable-next-line no-console
      console.log(
        `  ${type}: recibidos=${counts.valid + counts.invalid} `
          + `válidos=${counts.valid} INVÁLIDOS=${counts.invalid}`
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(`  ${type}: OK (${counts.valid})`);
    }
  }

  await connection.close();
  process.exitCode = anyInvalid ? 1 : 0;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[events-test-consumer] error inesperado: ${(error as Error).message}`);
  process.exitCode = 1;
});
