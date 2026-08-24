import joi from 'joi';
import { Transaction } from 'sequelize';
import { IdentityType } from '@jiku/models';
import { AuthEvent, INSTANCE } from '@jiku/nats-protocol';
import { sequelize } from '../models';
import logger from '../logger';
import { EventHandler } from './types';

/** El único `type` que este consumidor procesa. Cualquier otro se descarta (CA-11). */
const AUTHENTICATED = 'authenticated';
/** La única versión del contrato que este consumidor entiende (CA-11). */
const SUPPORTED_VERSION = 1;

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
    email: joi.string().required(),
    // Ausente o vacío -> lista vacía, Y NO ES UN DESCARTE. Es un evento válido con una lista
    // vacía: la consecuencia (esa identidad no queda autorizada a nada en el bus) la produce la
    // compuerta de autorización, no este consumidor.
    // Los items se declaran `string` a propósito: `roles: [1, 2]` descarta el evento con su
    // `warn` en vez de escribir un JSONB con números que la compuerta compararía contra strings
    // y nunca matchearía.
    roles: joi.array().items(joi.string()).default([]),
    // Sale del `type` de la regla de `rules.yaml` que matcheó, no de una heurística. Se valida
    // acá y no se delega a la base porque la columna es un ENUM NATIVO en producción y un STRING
    // en el `sync()` de los tests: un valor fuera del enum pasaría la suite y en producción
    // sería un error de Postgres -> rollback -> EVENTO PERDIDO SIN `warn`. Validarlo lo
    // convierte en un descarte diagnosticable.
    // El enum se DERIVA del modelo: un enum literal se desincroniza en silencio cuando la base
    // cambia; uno derivado rompe la compilación.
    identity_type: joi
      .string()
      .valid(...Object.values(IdentityType))
      .default(IdentityType.Person),
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
