import joi from 'joi';
import { Transaction } from 'sequelize';
import { AuthEvent, INSTANCE } from '@jiku/nats-protocol';
import { SERVICE_ROLES } from './auth/identity-type';
import { sequelize } from '../models';
import logger from '../logger';
import { EventHandler } from './types';

/** El único `type` que este consumidor procesa. Cualquier otro se descarta (CA-11). */
const AUTHENTICATED = 'authenticated';
/**
 * La única versión del contrato que este consumidor entiende (CA-11).
 *
 * **v2 desde S-069.** La v2 del callout es BREAKING y cambia una sola cosa que a core le importa:
 * **elimina `identity_type` del payload**. Ese campo reportaba el `type:` de la regla de
 * `rules.yaml` —lo que el YAML decía— y no algo verificado sobre el principal; la clasificación se
 * deriva ahora de `matched_role`, que es un hecho leído del token (ver
 * `events/auth/identity-type.ts`).
 *
 * ES UN REEMPLAZO, NO UNA LISTA: `valid(2)` y no `valid(1, 2)`. Un evento v1 se descarta con su
 * `warn`, que es el comportamiento correcto una vez que el emisor emite v2 — aceptar las dos
 * dejaría entrando un payload CON `identity_type`, que es justo el campo que esta versión deroga.
 *
 * CONSECUENCIA DE DESPLIEGUE, y hay que conocerla: mientras el callout siga emitiendo v1, este
 * consumidor descarta TODO evento y `users` deja de refrescarse —sin alta de identidades nuevas y
 * sin cambios de rol—. El orden es **callout primero, core después**.
 */
const SUPPORTED_VERSION = 2;

/**
 * Esquema del evento de autenticación.
 *
 * `.unknown(true)` ROMPE A PROPÓSITO la regla de la convención `validation` ("no agregues
 * `.unknown(true)`: un campo de más es una discrepancia de contrato"). Para los 20 comandos esa
 * regla es correcta, porque el emisor es la api y vive en este repo. Acá es al revés y es
 * criterio de aceptación: el schema del emisor VIVE EN OTRO REPO y puede crecer, así que un
 * campo nuevo del callout no puede tirar el consumidor. Los seis que hoy se ignoran
 * —`authenticated_at`, `expires_at`, `client_ip`, `session`, `matched_role`, `template`— pasan
 * sin declararse, y `client_ip` y `session` NO SE PERSISTEN NUNCA: es minimización de datos
 * personales, no solo alcance (RF-12).
 *
 * EL ESQUEMA VIVE ACÁ Y NO EN EL ARCHIVO DEL HANDLER, que es la otra desviación de `validation`.
 * Tres de las cuatro guardas —`type`, `version`, `instance`— son de ENRUTAMIENTO y de consumidor,
 * no reglas del payload: son lo que decide si este handler es el que corresponde. Partirlo entre
 * dos archivos dejaría la mitad del contrato en cada lado. EL DÍA QUE HAYA UN SEGUNDO TIPO DE
 * EVENTO, los cuatro campos específicos se mudan a su handler y el envelope se queda acá.
 *
 * `instance` se declara pero NO con `.valid(INSTANCE)`: el mensaje por defecto de Joi no imprime
 * el valor recibido, y el criterio exige LOS DOS valores en el log. La comparación va aparte y
 * antes, en `dispatch()`.
 */
const schema = joi
  .object({
    type: joi.string().valid(AUTHENTICATED).required(),
    version: joi.number().valid(SUPPORTED_VERSION).required(),
    instance: joi.string().required(),
    id: joi.string().max(100).required(),
    name: joi.string().required(),
    username: joi.string().required(),
    // OBLIGATORIO PARA UNA PERSONA, OPCIONAL PARA UNA IDENTIDAD DE SERVICIO, y la condición es
    // la regla entera: un machine user de Zitadel NO TIENE dirección de correo —`userinfo` no
    // devuelve el claim ni con `CALLOUT_IDP_ENRICH=profile`, así que el callout omite la clave—
    // y con `email` obligatorio su evento se descartaba con `"email" is required`. Sin fila en
    // `users`, las dos compuertas del bus lo rechazan: `caller_not_authorized` en todo comando y
    // `unknown_caller` en toda consulta.
    //
    // LAS TRES FORMAS DE "NO HAY" SE NORMALIZAN A `null` —ausente, `null` y cadena vacía—, así
    // el handler no distingue tres ausencias que significan lo mismo. La cadena vacía no es
    // teórica: es la forma que toma el evento si `CALLOUT_IDP_ENRICH` no está configurado, y el
    // compose lo documenta.
    //
    // PARA UNA PERSONA LAS TRES SIGUEN SIENDO DESCARTE, y esa mitad importa tanto como la otra:
    // ahí el faltante no es una propiedad de la identidad sino un emisor mal configurado, y el
    // `warn` es el único diagnóstico que hay. Inventarle un valor taparía el problema.
    //
    // LA CONDICIÓN SE APOYA AHORA EN `matched_role` Y YA NO EN `identity_type` (v2, S-069): el
    // campo que la decidía DESAPARECIÓ del payload. Se compara contra la misma lista de roles de
    // servicio de la que sale la clasificación, así que la regla del `email` y la columna
    // `identity_type` NO PUEDEN DISCREPAR — una sola fuente decide las dos.
    //
    // EL `.required()` DEL `is` NO ES DECORACIÓN, Y ES LA TRAMPA DE ESTE BLOQUE: sin él, un evento
    // SIN `matched_role` SATISFACE la condición —Joi da por buena la ausencia contra un esquema
    // opcional— y cae en `then`, que es la rama que vuelve el `email` opcional. O sea, justo al
    // revés de lo que hay que hacer: un emisor que dejara de mandar el campo empezaría a crear
    // personas sin dirección, en silencio. Con `.required()` la ausencia cae en `otherwise` y
    // exige `email`, que es la MISMA rama segura en la que caía un evento sin `identity_type` en
    // la v1. Hay un test por cada mitad.
    email: joi.string().when('matched_role', {
      is: joi.string().valid(...SERVICE_ROLES).required(),
      then: joi.string().allow(null).empty('').default(null),
      otherwise: joi.string().required(),
    }),
    // Ausente o vacío -> lista vacía, Y NO ES UN DESCARTE. Es un evento válido con una lista
    // vacía: la consecuencia (esa identidad no queda autorizada a nada en el bus) la produce la
    // compuerta de autorización, no este consumidor.
    // Los items se declaran `string` a propósito: `roles: [1, 2]` descarta el evento con su
    // `warn` en vez de escribir un JSONB con números que la compuerta compararía contra strings
    // y nunca matchearía.
    roles: joi.array().items(joi.string()).default([]),
    // `identity_type` YA NO SE DECLARA: la v2 lo eliminó del payload (S-069). La columna sigue
    // existiendo y sigue importando —separa una persona de un service user, y de eso depende que
    // un `Usuario` de servicio no aparezca en `people.list`—, pero su valor se DERIVA de
    // `matched_role` en `auth/identity-type.ts`, que es un hecho leído del token y no lo que
    // declaraba el YAML.
    //
    // NO SE VALIDA `matched_role` CONTRA UN CATÁLOGO, a propósito y por el mismo criterio con el
    // que `roles` no se valida: un rol desconocido es un valor legítimo del cable que clasifica
    // como `person` (el default de siempre), no un evento a descartar. El catálogo vive en
    // `rules.yaml`, no acá.
    //
    // Y NO HACE FALTA VALIDARLO PARA PROTEGER LA COLUMNA —que es un ENUM NATIVO en producción y un
    // STRING en el `sync()` de los tests, la razón por la que el campo viejo SÍ se validaba—:
    // `identityTypeFromMatchedRole` devuelve un `IdentityType`, así que un valor fuera del enum es
    // hoy IMPOSIBLE DE CONSTRUIR. La garantía pasó de una validación a un tipo.
  })
  .unknown(true);

/**
 * Traduce un evento del bus a la ejecución de su handler.
 *
 * Es un objeto distinto de los otros dos despachadores y no una rama de ninguno. El evento se
 * diferencia del comando en CUATRO cosas: no hay `Reply`, no hay `caller` en el subject, la
 * semántica de actualización es REEMPLAZO TOTAL y no edición parcial, y el `status` no existe
 * para decidir la transacción. Cuatro `if` en un despachador son un despachador distinto — es el
 * mismo razonamiento que dejó escrito `queries/dispatcher.ts`, con un `if` más de distancia.
 *
 * NUNCA LANZA, y acá no es una precaución: es lo que mantiene vivo al consumidor. Una excepción
 * que escape mata el `for await` de la suscripción y core DEJA DE RECIBIR EVENTOS PARA SIEMPRE,
 * con un solo error en el log al principio. Los 20 comandos siguen atendiendo, así que ningún
 * healthcheck lo nota.
 */
export class EventDispatcher {
  constructor(private handler: EventHandler<AuthEvent>) {}

  async dispatch(raw: unknown): Promise<void> {
    // LA GUARDA DE `instance` VA PRIMERO, antes del esquema. Un evento dirigido a otra instancia
    // no es nuestro y no hay por qué validarle la forma. Y sobre todo: es la guarda con más
    // valor de diagnóstico del servicio. Tres causas distintas dan el mismo síntoma ("no llega
    // ni un evento"): el `sub.allow` sin la línea, el subject desalineado, y el payload con otra
    // `instance`. LOS DOS VALORES EN ESTE LOG SON LO ÚNICO QUE LAS SEPARA.
    // El `?.` cubre los cinco cuerpos que son JSON válido y no un objeto (`null`, un número, un
    // string, un array) sin un `typeof` extra.
    const instance = (raw as { instance?: unknown } | null | undefined)?.instance;
    if (instance !== INSTANCE) {
      logger.warn(
        `[events] descartado: instance del evento (${String(instance)}) != instance del ` +
          `consumidor (${INSTANCE})`
      );
      return;
    }

    const result = schema.validate(raw, { convert: true, abortEarly: true });
    if (result.error) {
      // El mensaje de Joi nombra el campo y el valor esperado, no el payload. Es lo que hace que
      // este `warn` sea publicable: nunca imprime `email`, `client_ip` ni el id de sesión.
      logger.warn(`[events] descartado: ${result.error.message}`);
      return;
    }
    const event = result.value as AuthEvent;

    // RECIÉN ACÁ la transacción, después de las guardas: un evento inválido no consume una
    // conexión del pool. Es el mismo criterio con que la validación de un comando corre antes.
    //
    // Y VA EN SU PROPIO try: abrirla puede fallar sola (pool agotado, base caída), y ese rechazo
    // escaparía de `dispatch()`. "El despachador nunca lanza" no admite un camino donde sí.
    let transaction: Transaction;
    try {
      transaction = await sequelize.transaction();
    } catch (error: any) {
      logger.error(`[events] ${event.id}: ${error.message}`);
      return;
    }

    try {
      const outcome = await this.handler(event, { transaction });
      if (outcome === 'applied') {
        await transaction.commit();
      } else {
        await transaction.rollback();
        // El `id` y nada más: el handler no devuelve una razón —el `outcome` es un par de
        // strings— y agregarle una sería ampliar el contrato sin criterio que lo pida.
        logger.warn(`[events] ${event.id}: discarded:handler`);
      }
    } catch (error: any) {
      // EL ROLLBACK NO PUEDE SER LA FUENTE DE UN RECHAZO: si lo que falló fue el `commit`, la
      // transacción ya terminó y `rollback()` sobre una terminada rechaza. Ese segundo rechazo
      // escaparía de `dispatch()` y taparía el error original, que es el que hay que ver.
      await transaction.rollback().catch(() => undefined);
      // El detalle va al log y no cruza a ningún lado: no hay a quién contestarle. El evento se
      // pierde, y es el comportamiento aceptado.
      logger.error(`[events] ${event.id}: ${error.message}`);
    }
  }
}

export default EventDispatcher;
