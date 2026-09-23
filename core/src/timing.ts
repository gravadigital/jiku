import { AsyncLocalStorage } from 'async_hooks';
import { monitorEventLoopDelay, performance } from 'perf_hooks';
import logger from './logger';

/**
 * Instrumentación de tiempos por request, para diagnosticar latencia de punta a punta.
 *
 * APAGADA POR DEFECTO: con `QUERY_TIMING` distinto de `true` ninguna función de este módulo hace
 * nada más que devolver, y el camino de una request es el de siempre.
 *
 * Encendida:
 *   - cada request que entra por el bus abre una TRAZA, que viaja por `AsyncLocalStorage` y no
 *     por parámetro: así `selectRows`, la lectura del caller y los hooks del pool registran sus
 *     tramos sin tocar ninguna firma del motor.
 *   - al responder se loguea UNA línea `[timing] {json}` y el mismo desglose viaja al caller en
 *     el header `Jiku-Timing`, junto con los relojes de pared de llegada y respuesta
 *     (`Jiku-Recv-At`, `Jiku-Resp-At`, en ns). Si el caller mandó `Jiku-Sent-At` —el cliente Go
 *     lo hace con su traza activa— y los dos procesos comparten reloj (local), la diferencia es
 *     el tramo de ida por el bus, con la espera en el event loop de core incluida.
 *   - `QUERY_TIMING_SQL=true` agrega el SQL de cada sentencia a la línea de log, para poder
 *     correrlo después con `EXPLAIN ANALYZE`.
 */

export const TIMING_ENABLED = process.env.QUERY_TIMING === 'true';
const TIMING_SQL = process.env.QUERY_TIMING_SQL === 'true';

export const SENT_AT_HEADER = 'Jiku-Sent-At';
export const TRACE_ID_HEADER = 'Jiku-Trace-Id';
export const TIMING_HEADER = 'Jiku-Timing';
export const RECV_AT_HEADER = 'Jiku-Recv-At';
export const RESP_AT_HEADER = 'Jiku-Resp-At';

export interface Span {
  name: string;
  /** Milisegundos desde el inicio de la traza. */
  start: number;
  ms: number;
  rows?: number;
  sql?: string;
}

export interface Trace {
  id?: string;
  subject: string;
  /** `process.hrtime.bigint()` al entrar al handler. */
  t0: bigint;
  /** Reloj de pared al entrar al handler, en ns. */
  recvAt: bigint;
  /** El `Jiku-Sent-At` del caller, si vino. */
  sentAt?: bigint;
  reqBytes: number;
  respBytes?: number;
  spans: Span[];
  /** Adquisiciones del pool en curso, para medir la espera por una conexión. */
  acquiring: bigint[];
}

const storage = new AsyncLocalStorage<Trace>();

const nowNs = (): bigint => process.hrtime.bigint();
// Reloj de pared con resolución de microsegundos: el origen de pared del proceso más el reloj
// monotónico. `Date.now()` solo tiene milisegundos, que es el orden de lo que se quiere medir.
const wallNs = (): bigint =>
  BigInt(Math.round((performance.timeOrigin + performance.now()) * 1e3)) * BigInt(1000);
const msSince = (from: bigint, to: bigint = nowNs()): number =>
  Math.round(Number(to - from) / 1e3) / 1e3;

export function currentTrace(): Trace | undefined {
  return TIMING_ENABLED ? storage.getStore() : undefined;
}

/** Abre una traza y corre `fn` dentro de ella. Sin instrumentación, corre `fn` y nada más. */
export function withTrace<T>(
  init: { subject: string; reqBytes: number; sentAt?: string; id?: string },
  fn: (trace?: Trace) => Promise<T>
): Promise<T> {
  if (!TIMING_ENABLED) {
    return fn();
  }
  const trace: Trace = {
    id: init.id,
    subject: init.subject,
    t0: nowNs(),
    recvAt: wallNs(),
    reqBytes: init.reqBytes,
    spans: [],
    acquiring: [],
  };
  if (init.sentAt && /^\d+$/.test(init.sentAt)) {
    trace.sentAt = BigInt(init.sentAt);
  }
  return storage.run(trace, () => fn(trace));
}

/**
 * Prefija el SQL con un comentario `/* <traceId> <label> *\/` cuando hay traza.
 *
 * Es lo que permite cruzar la línea `duration:` del log de PostgreSQL
 * (`log_min_duration_statement`) con el tramo de core que la ejecutó: la diferencia entre los
 * dos es driver, red hasta la base y parseo de filas. Sin traza el SQL no cambia.
 */
export function tagSql(sql: string, label: string): string {
  const trace = currentTrace();
  if (!trace) {
    return sql;
  }
  return `/* ${(trace.id ?? '-').replace(/[^\w.-]/g, '')} ${label.replace(/[^\w.#-]/g, '')} */\n${sql}`;
}

/** Mide `fn` como un tramo de la traza actual. */
export async function span<T>(
  name: string,
  fn: () => Promise<T> | T,
  describe?: (value: T) => Partial<Pick<Span, 'rows' | 'sql'>>
): Promise<T> {
  const trace = currentTrace();
  if (!trace) {
    return fn();
  }
  const start = nowNs();
  const value = await fn();
  const extra = describe ? describe(value) : {};
  if (extra.sql && !TIMING_SQL) {
    delete extra.sql;
  }
  trace.spans.push({ name, start: msSince(trace.t0, start), ms: msSince(start), ...extra });
  return value;
}

/** Versión síncrona de `span`, para el trabajo de CPU (proyección, paginado, serialización). */
export function spanSync<T>(name: string, fn: () => T): T {
  const trace = currentTrace();
  if (!trace) {
    return fn();
  }
  const start = nowNs();
  const value = fn();
  trace.spans.push({ name, start: msSince(trace.t0, start), ms: msSince(start) });
  return value;
}

/**
 * Engancha la espera por una conexión del pool en los tramos de la traza actual.
 *
 * Es un tramo aparte del de la sentencia porque son dos causas distintas de lentitud: un pool
 * agotado se arregla con conexiones, una sentencia lenta con SQL o índices.
 */
export function instrumentPool(db: {
  addHook: (name: any, fn: (...args: any[]) => void) => unknown;
}, label: string): void {
  if (!TIMING_ENABLED) {
    return;
  }
  db.addHook('beforePoolAcquire', () => {
    storage.getStore()?.acquiring.push(nowNs());
  });
  db.addHook('afterPoolAcquire', () => {
    const trace = storage.getStore();
    const start = trace?.acquiring.shift();
    if (trace && start !== undefined) {
      trace.spans.push({
        name: `pool.acquire:${label}`,
        start: msSince(trace.t0, start),
        ms: msSince(start),
      });
    }
  });
}

/** El desglose que viaja en el header y en el log. */
export interface TimingSummary {
  id?: string;
  subject: string;
  /** Tiempo total dentro de core, del handler al `respond()`. */
  totalMs: number;
  /** Ida por el bus: `recvAt - sentAt`, solo si el caller mandó su reloj. */
  inboundMs?: number;
  reqBytes: number;
  respBytes?: number;
  spans: Span[];
}

export function summarize(trace: Trace): TimingSummary {
  const summary: TimingSummary = {
    subject: trace.subject,
    totalMs: msSince(trace.t0),
    reqBytes: trace.reqBytes,
    spans: trace.spans,
  };
  if (trace.id) {
    summary.id = trace.id;
  }
  if (trace.sentAt !== undefined) {
    summary.inboundMs = Math.round(Number(trace.recvAt - trace.sentAt) / 1e3) / 1e3;
  }
  if (trace.respBytes !== undefined) {
    summary.respBytes = trace.respBytes;
  }
  return summary;
}

/** Los headers de tiempo de la respuesta. El SQL nunca viaja: queda solo en el log. */
export function timingHeaders(trace: Trace): Record<string, string> {
  const summary = summarize(trace);
  const compact = {
    ...summary,
    spans: summary.spans.map((s) => {
      const rest = { ...s };
      delete rest.sql;
      return rest;
    }),
  };
  return {
    [TIMING_HEADER]: JSON.stringify(compact),
    [RECV_AT_HEADER]: trace.recvAt.toString(),
    [RESP_AT_HEADER]: wallNs().toString(),
  };
}

export function logTrace(trace: Trace): void {
  logger.info(`[timing] ${JSON.stringify(summarize(trace))}`);
}

/**
 * Retardo del event loop (resolución de 1 ms: ese es el piso de los valores), logueado cada `QUERY_TIMING_LOOP_MS` (30 s por defecto).
 *
 * Un event loop bloqueado demora a TODAS las requests por igual y no aparece en ningún tramo:
 * se ve solo como `inboundMs` alto. Esta línea es lo que permite atribuirlo.
 */
export function startLoopMonitor(): void {
  if (!TIMING_ENABLED) {
    return;
  }
  const histogram = monitorEventLoopDelay({ resolution: 1 });
  histogram.enable();
  const every = Number(process.env.QUERY_TIMING_LOOP_MS) || 30000;
  setInterval(() => {
    const ms = (ns: number): number => Math.round(ns / 1e4) / 100;
    logger.info(
      `[timing] event-loop ${JSON.stringify({
        p50Ms: ms(histogram.percentile(50)),
        p99Ms: ms(histogram.percentile(99)),
        maxMs: ms(histogram.max),
      })}`
    );
    histogram.reset();
  }, every).unref();
}
