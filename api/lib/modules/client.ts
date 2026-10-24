import { Response } from 'express';
import { ErrorCode, NatsError } from 'nats';
import logger from '../logger';
import { bus } from '../utils/bus';
import buildActor from '../utils/bus/actor';
import { Reply } from '../utils/bus/protocol';
import { docsErrorBody, docsHttpStatusFor } from './docs/errors';
import { moduleUnavailableBody, respondIfModuleNotReady } from './module-errors';
import { ModuleName, registryFor } from './registry';

export type { ModuleName };

export interface ModuleCallOptions {
  /**
   * Sin `actor`: quita cualquier `actor` del payload. S-080 terminó usando `sendToModule` para
   * `shares.resolve` / `shares.attachment` (necesita páginas HTML, no JSON), así que esta opción se
   * conserva por compatibilidad (TS-26 de S-077) y no tiene llamadores en producción.
   */
  anonymous?: boolean;
}

const ERRORS_BY_MODULE: Record<
  ModuleName,
  { statusFor: (code: string | undefined) => number; body: (reply: Reply) => Record<string, unknown> }
> = {
  docs: { statusFor: docsHttpStatusFor, body: docsErrorBody },
};

/**
 * Embudo por el que las rutas de documentación hablan con un módulo (jiku-docs).
 *
 * EXCEPCIÓN A ADR-001: acá la api LEE por el bus, porque la documentación no está en su base
 * (se documenta como ADR-015 en S-085).
 *
 * DD-1: se llama SIEMPRE en nombre de la persona con `actor: { id }` (solo `id`). Un llamado
 * sin `actor` lo trata jiku-docs como el propio servicio (clase `service`, lee todo), así que
 * acá se FALLA CERRADO: sin identidad verificada y sin `anonymous` → 401 sin publicar. Es lo
 * opuesto a `withActor` de core, y por eso no se reusan `sendCommand` ni `withActor`: su sobre
 * (`roles`, `name`...) es `invalid_fields` para jiku-docs.
 *
 * El `actor` lo inyecta el embudo después del spread: gana el del token.
 *
 * `payload` y `options` NUNCA se loguean (contenido de documentos, tokens de links).
 *
 * Devuelven el `data`, o `null` si ya respondieron el error (el llamador corta).
 */
async function call<T>(
  kind: 'query' | 'command',
  res: Response,
  module: ModuleName,
  method: string,
  payload: Record<string, unknown>,
  options: ModuleCallOptions = {}
): Promise<T | null> {
  const registry = registryFor(module);
  if (respondIfModuleNotReady(res, module, registry)) {
    return null;
  }

  let body: Record<string, unknown>;
  if (options.anonymous) {
    body = { ...payload };
    delete body.actor;
  } else {
    const id = buildActor(res.req)?.id;
    if (!id) {
      res.status(401).json({ code: 'unauthorized', message: 'Unauthorized' });
      return null;
    }
    body = { ...payload, actor: { id } };
  }

  const outcome = await sendToModule<T>(kind, module, method, body);
  switch (outcome.kind) {
  case 'timeout':
    res.status(504).json({ code: 'gateway_timeout', message: 'La operación tardó demasiado' });
    return null;
  case 'unreachable':
    res.status(503).json(moduleUnavailableBody(module));
    return null;
  case 'failure': {
    const errors = ERRORS_BY_MODULE[module];
    res.status(errors.statusFor(outcome.reply.errorCode)).json(errors.body(outcome.reply));
    return null;
  }
  default:
    return outcome.data;
  }
}

export type ModuleOutcome<T> =
  | { kind: 'data'; data: T | null }
  | { kind: 'failure'; reply: Reply } // reply.status !== 'success'
  | { kind: 'timeout' } // NatsError Timeout
  | { kind: 'unreachable' }; // sin record, no responders (+ markUnavailable), bus no conectado, otro error

/**
 * Publica `body` TAL CUAL (no agrega ni quita `actor`) y clasifica el resultado, en vez de responder
 * HTTP. No mira el estado del módulo: eso queda para quien llama. La usan `call()` (respuestas JSON)
 * y las rutas públicas de links compartidos (S-080, páginas HTML). Loguea
 * `[modules] {module} {method}: {error.message}` en los errores del bus; `body` nunca se loguea.
 */
export async function sendToModule<T>(
  kind: 'query' | 'command',
  module: ModuleName,
  method: string,
  body: Record<string, unknown>
): Promise<ModuleOutcome<T>> {
  const registry = registryFor(module);
  const target = registry.record();
  if (!target) {
    return { kind: 'unreachable' };
  }

  let reply: Reply<T>;
  try {
    reply =
      kind === 'query'
        ? await bus().queryModule<T>(target, method, body)
        : await bus().commandModule<T>(target, method, body);
  } catch (error: any) {
    logger.error(`[modules] ${module} ${method}: ${error.message}`);

    // ErrorCode.NoResponders es '503' (colisiona con JetStreamNotEnabled); en un request plano
    // es no-responders.
    if (error instanceof NatsError && error.code === ErrorCode.Timeout) {
      return { kind: 'timeout' };
    }
    if (error instanceof NatsError && error.code === ErrorCode.NoResponders) {
      void registry.markUnavailable();
    }
    return { kind: 'unreachable' };
  }

  if (reply.status !== 'success') {
    return { kind: 'failure', reply };
  }

  return { kind: 'data', data: (reply.data ?? null) as T | null };
}

export function moduleQuery<T = any>(
  res: Response,
  module: ModuleName,
  method: string,
  payload: Record<string, unknown>,
  options?: ModuleCallOptions
): Promise<T | null> {
  return call<T>('query', res, module, method, payload, options);
}

export function moduleCommand<T = any>(
  res: Response,
  module: ModuleName,
  method: string,
  payload: Record<string, unknown>,
  options?: ModuleCallOptions
): Promise<T | null> {
  return call<T>('command', res, module, method, payload, options);
}

/** Como `runCommand`: un comando exitoso sin `data` no se distinguiría de un error. */
export async function runModuleCommand(
  res: Response,
  module: ModuleName,
  method: string,
  payload: Record<string, unknown>,
  options?: ModuleCallOptions
): Promise<boolean> {
  await moduleCommand(res, module, method, payload, options);
  return !res.headersSent;
}
