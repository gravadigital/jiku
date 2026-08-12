interface PublicPath {
  get: string[];
  patch: string[];
  post: string[];
  delete: string[];
}

/**
 * Rutas exentas de `validateToken`. Todo lo que no esté acá exige token: la exención es
 * la excepción, no la regla (ver `publicPaths`, que arma un regex de exclusión).
 *
 * Agregar algo a esta lista deja el endpoint accesible sin credencial: solo va acá lo que
 * tenga su propio control de acceso.
 *
 * `api/opus/attachments/:id/public` lo tiene: valida `visibilityLevel === 'public'` por
 * cada `entityType` y responde 403 en cualquier otro caso.
 */
const publicPath: PublicPath = {
  get: ['api/opus/attachments/\\d+/public'],
  patch: [],
  post: [],
  delete: []
};

export default function publicPaths(method: string) {
  const prefix = '^\/';
  const pathRegexStr = prefix + (publicPath as any)[method.toLowerCase()].map((path: string) => {
    return `(?!${path})`;
  }).join('') + '.*';
  return new RegExp(pathRegexStr, 'i');
}

