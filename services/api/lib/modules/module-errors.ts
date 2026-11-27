import { Response } from 'express';
import { ModuleName, ModuleRegistry } from './registry';

/** Cuerpo 503 compartido: lo usan el cliente de módulo y `requireModule`, para que no diverjan. */
export function moduleUnavailableBody(module: ModuleName) {
  return { code: 'module_unavailable', message: `El módulo ${module} no está disponible en este momento` };
}

/**
 * Responde 404/503 si el módulo no está `available`. Devuelve `true` si respondió (el llamador
 * tiene que cortar, sin publicar ni llamar a `next()`). `incompatible` se ve como `not_installed`.
 */
export function respondIfModuleNotReady(res: Response, module: ModuleName, registry: ModuleRegistry): boolean {
  const status = registry.status();
  if (status === 'available') {
    return false;
  }
  if (status === 'unavailable') {
    res.status(503).json(moduleUnavailableBody(module));
    return true;
  }
  res.status(404).json({ code: 'module_not_installed', message: `El módulo ${module} no está instalado` });
  return true;
}
