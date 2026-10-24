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
  /** Sin `actor`: SOLO para `shares.resolve` / `shares.attachment` (S-080). Quita cualquier `actor` del payload. */
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

  const target = registry.record();
  if (!target) {
    res.status(503).json(moduleUnavailableBody(module));
    return null;
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
      res.status(504).json({ code: 'gateway_timeout', message: 'La operación tardó demasiado' });
      return null;
    }
    if (error instanceof NatsError && error.code === ErrorCode.NoResponders) {
      void registry.markUnavailable();
    }
    res.status(503).json(moduleUnavailableBody(module));
    return null;
  }

  if (reply.status !== 'success') {
    const errors = ERRORS_BY_MODULE[module];
    res.status(errors.statusFor(reply.errorCode)).json(errors.body(reply));
    return null;
  }

  return (reply.data ?? null) as T | null;
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
