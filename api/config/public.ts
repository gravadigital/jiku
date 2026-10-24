interface PublicPath {
  get: string[];
  patch: string[];
  post: string[];
  put: string[];
  delete: string[];
}

/**
 * Rutas exentas de `validateToken`. Todo lo que no esté acá exige token: la exención es
 * la excepción, no la regla (ver `publicPaths`, que arma un regex de exclusión).
 *
 * HAY UNA SOLA EXENCIÓN desde REQ-016 / S-080: `GET /p/docs/` (DD-10), los links compartidos de
 * documentación. Hasta REQ-002 / S-009 las cinco listas estuvieron vacías a propósito: la única
 * exención que hubo —`api/opus/attachments/:id/public`, el link público de adjuntos— fue eliminada
 * junto con su handler, porque era la última superficie del producto que podía originar una
 * descarga sin credencial. Los otros cuatro métodos (`patch`, `post`, `put`, `delete`) siguen sin
 * ninguna exención: su regex queda en `^\/.*` y `validateToken` cubre todo path.
 *
 * El control propio de `/p/docs/*` (ADR-008: "solo va lo que implemente su propio control de
 * acceso, y ese control tiene que quedar documentado") es: host público exclusivo
 * (`JIKU_PUBLIC_URL`, 404 en cualquier otro host), rate limit de 60/min/IP, token de 256 bits que
 * valida jiku-docs contra su hash, un 404 indistinguible para cualquier link inválido y cabeceras de
 * solo lectura (CSP, noindex, no-store) en toda respuesta. Ver `lib/public-routes/`.
 *
 * EL MECANISMO SE CONSERVA POR DISEÑO, no por inercia: declarar algo público a futuro —un
 * healthcheck, por ejemplo— tiene que seguir siendo un cambio de UNA línea en un archivo cuyo
 * único propósito es enumerar lo público. Esa es la garantía de revisión que buscaba ADR-008:
 * exponer algo exige intención y ocurre acá, no perdido entre la lógica de un handler. Borrar
 * `publicPaths` "porque ya no se usa" destruiría esa garantía.
 *
 * Agregar una entrada acá deja el endpoint accesible SIN CREDENCIAL: es un cambio de
 * seguridad y se revisa como tal.
 *
 * `PUT` ESTÁ CUBIERTO DESDE REQ-016 (H-3): antes la interfaz no lo declaraba y el único `PUT`
 * (`week-assigned-times-put.ts`) tenía que declarar `validateToken` en su propia cadena, lo que
 * ADR-008 prohíbe. Son cinco los métodos cubiertos; un método HTTP nuevo que use la api tiene que
 * agregarse acá y en `app.ts`, o sus rutas quedarían sin la autenticación global.
 */
const publicPath: PublicPath = {
  get: ['p/docs/'],
  patch: [],
  post: [],
  put: [],
  delete: []
};

export default function publicPaths(method: string) {
  const prefix = '^\/';
  const pathRegexStr = prefix + (publicPath as any)[method.toLowerCase()].map((path: string) => {
    return `(?!${path})`;
  }).join('') + '.*';
  return new RegExp(pathRegexStr, 'i');
}

