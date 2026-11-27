import { NextFunction, Request, Response } from 'express';
import { respondIfModuleNotReady } from '../../modules/module-errors';
import { ModuleName, registryFor } from '../../modules/registry';

/**
 * Corta con 404 `module_not_installed` o 503 `module_unavailable` según el estado del módulo.
 *
 * Va ANTES de `hasAnyRole`: `requireModule('docs') -> hasAnyRole -> Joi`. `incompatible` se ve
 * como `not_installed` hacia afuera (RF-4). Lee el estado en memoria (DD-5): no consulta el bus.
 * Un middleware que responde no llama a `next()`.
 */
export default function requireModule(module: ModuleName) {
  return function (_req: Request, res: Response, next: NextFunction) {
    if (respondIfModuleNotReady(res, module, registryFor(module))) {
      return;
    }
    return next();
  };
}
