import { Request } from 'express';
import { Actor } from '@jiku/nats-protocol';
// La augmentación de `Express.Request` —`decodedToken` y `decodedTokenRoles`— vive en
// `lib/interfaces/index.ts` y se instala por efecto de importarla. `app.ts` ya lo hace, así que en
// producción sobra; se importa acá igual porque este módulo es el ÚNICO de `lib/` que se carga
// AISLADO, desde su test unitario, y ts-node compila archivo por archivo: sin esto, el test de
// `buildActor` falla a compilar con "Property 'decodedToken' does not exist on type 'Request'".
import '../../interfaces';

/**
 * Un claim de perfil sólo viaja si es un string NO VACÍO.
 *
 * Recibe `unknown` A PROPÓSITO aunque `DecodedToken` los declare `string`: lo que llega es un JWT
 * de una instancia de Zitadel, y el tipo describe lo que se espera, no lo que garantiza el cable.
 *
 * La ausencia se propaga COMO AUSENCIA y no como `undefined` presente: el espejo de core
 * distingue "no lo mandaron" de "lo mandaron vacío", y de eso depende que un sobre sin `name` no
 * borre el nombre que la fila ya tenía (CA-11). Además `JSON.stringify` borra las claves con
 * valor `undefined`, así que ponerlas sería igual de inútil y más confuso de leer.
 */
function claimString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * El sobre de identidad, armado CON EL CLAIM YA VERIFICADO contra Zitadel.
 *
 * NO LEE `req.user`, Y NO ES UN DESCUIDO. La fila está ahí, cargada por `validateToken`, con los
 * cinco campos y hasta con `roles`. Usarla es un cambio de una línea que PARECE una mejora
 * —"armemos el sobre con lo que ya tenemos en la base"— y que introduce DOS FUENTES DE IDENTIDAD
 * para lo mismo, con la peor de las dos decidiendo. ADR-007 lo prohíbe con todas las letras: "NO
 * SE DEBEN almacenar roles en la base ni derivarlos de otra fuente". El claim es además MÁS
 * FRESCO que la fila, y es justamente el espejo de core el que hace que las dos converjan.
 *
 * DEVUELVE `undefined` SIN TOKEN VERIFICADO. Hoy es inalcanzable —las cuatro listas de
 * `config/public.ts` están vacías, así que no hay ruta sin `validateToken`—, pero si alguna vez
 * hubiera una, omitir el sobre deja EXACTAMENTE el comportamiento de hoy (core resuelve por
 * `creator`/`author`/`editor`/`uploader`, rama 2 de `resolveActor`) en vez de un 500. Es la
 * dirección segura: no amplía nada.
 */
export function buildActor(req: Request | undefined): Actor | undefined {
  const decoded = req?.decodedToken;
  const id = claimString(decoded?.sub);
  if (!id) {
    return undefined;
  }

  // `roles` es OBLIGATORIO en el contrato: sin claim va `[]`, nunca `undefined`. Un rol vacío no
  // autoriza nada (ADR-008), que es el resultado correcto.
  const actor: Actor = { id, roles: req?.decodedTokenRoles ?? [] };

  const name = claimString(decoded?.name);
  if (name) {
    actor.name = name;
  }

  // El claim de OIDC se llama `preferred_username`; la columna y el sobre, `username`. La
  // traducción vive acá, en `lib/utils/bus/`, y no dispersa en los handlers.
  const username = claimString(decoded?.preferred_username);
  if (username) {
    actor.username = username;
  }

  const email = claimString(decoded?.email);
  if (email) {
    actor.email = email;
  }

  // NO SE AGREGA `identityType`, y no es un olvido: `Actor` no lo declara y core escribe 'person'
  // como literal. Mandarlo le daría a la api la capacidad de declarar que una persona es un
  // servicio — superficie de seguridad regalada a cambio de nada.
  return actor;
}

export default buildActor;
