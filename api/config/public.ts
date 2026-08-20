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
 * LAS CUATRO LISTAS ESTÁN VACÍAS A PROPÓSITO desde REQ-002 / S-009: no quedaron vacías por
 * descuido. La única exención que hubo —`api/opus/attachments/:id/public`, el link público de
 * adjuntos— fue eliminada junto con su handler, porque era la última superficie del producto
 * que podía originar una descarga sin credencial. Con las listas vacías el regex que devuelve
 * `publicPaths(m)` queda en `^\/.*` (case-insensitive), que matchea todo path, así que
 * `validateToken` cubre los cuatro métodos que `app.ts` instala globalmente y no queda
 * ninguna ruta exenta.
 *
 * EL MECANISMO SE CONSERVA POR DISEÑO, no por inercia: declarar algo público a futuro —un
 * healthcheck, por ejemplo— tiene que seguir siendo un cambio de UNA línea en un archivo cuyo
 * único propósito es enumerar lo público. Esa es la garantía de revisión que buscaba ADR-008:
 * exponer algo exige intención y ocurre acá, no perdido entre la lógica de un handler. Borrar
 * `publicPaths` "porque ya no se usa" destruiría esa garantía.
 *
 * Agregar una entrada acá deja el endpoint accesible SIN CREDENCIAL: es un cambio de
 * seguridad y se revisa como tal. Solo va lo que implemente su propio control de acceso, y
 * ese control tiene que quedar documentado.
 *
 * OJO CON EL `PUT`: la interfaz no lo declara, así que `publicPaths('put')` lanza `TypeError`
 * y `app.ts` no lo instala. Un `PUT` nuevo NO queda protegido por la cobertura global: tiene
 * que declarar `validateToken` en su propia cadena, o hay que agregar el método acá.
 */
const publicPath: PublicPath = {
  get: [],
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

