import { Sequelize } from 'sequelize-typescript';
import {
  ErrorCode,
  Reply,
  callerFromSubject,
  failure,
  methodFromSubject,
} from '@jiku/nats-protocol';
import { authorizeWithRoles, readCallerRoles } from '../authorize-caller';
import logger from '../logger';
import { resolveCallerClass } from './caller-class';
import { QueryRegistry } from './registry';
import { CallerClass, QueryContext } from './types';

/**
 * Presupuesto de bytes cuando la conexión no está disponible o no anuncia `max_payload`.
 *
 * DE DÓNDE SALE EL NÚMERO: el `max_payload` por defecto de un server NATS es 1 MiB (1048576), y
 * el presupuesto del contrato es la MITAD (`floor(max_payload * 0.5)`), o sea 524288. La mitad y
 * no el total porque el mensaje que se mide es el item por item, y el envelope, el cursor y el
 * framing del protocolo también ocupan.
 */
export const DEFAULT_PAYLOAD_BUDGET_BYTES = 524288;

/**
 * El mensaje de `unknown_caller`.
 *
 * NO DICE SI LA FILA EXISTE, ni nombra al caller, ni al método, ni la tabla. Mismo criterio que el
 * `DENIED_MESSAGE` de la compuerta de S-017: el mensaje no puede ser un oráculo de identidad.
 *
 * Y ES DISTINTO DEL DE ESA COMPUERTA A PROPÓSITO: son dos códigos y dos causas. Un mensaje
 * compartido invitaría a fusionar los códigos, que es exactamente el bug que el comentario de
 * `UNKNOWN_CALLER` en `@jiku/nats-protocol` pide no cometer.
 */
const UNKNOWN_CALLER_MESSAGE = 'No se pudo resolver la identidad del caller';

/**
 * El presupuesto de una request a partir del `max_payload` que anuncia el server.
 *
 * SE EVALÚA POR REQUEST y no se cachea al arranque: una reconexión a un server con otra
 * configuración cambia el número, y un valor cacheado seguiría midiendo contra el server viejo.
 */
export function budgetFrom(maxPayload: number | undefined): number {
  if (!maxPayload || !Number.isFinite(maxPayload) || maxPayload <= 0) {
    return DEFAULT_PAYLOAD_BUDGET_BYTES;
  }
  return Math.floor(maxPayload * 0.5);
}

/**
 * Traduce un mensaje del bus a la ejecución de una consulta.
 *
 * Es un objeto distinto del despachador de comandos y no una rama del mismo: ADR-003 dedica
 * cuatro de sus seis reglas a la transacción, y ninguna tiene contraparte acá. Meterle un
 * `if (esConsulta)` al despachador de comandos sería exactamente lo que ese ADR desaconseja.
 *
 * Nunca lanza: del otro lado hay una request esperando respuesta.
 */
export class QueryDispatcher {
  constructor(
    private registry: QueryRegistry,
    private db: Sequelize,
    /**
     * Proveedor PEREZOSO del presupuesto de bytes: se invoca en CADA `dispatch()`.
     *
     * Opcional para no romper las construcciones que no lo necesitan. Sin él, el contexto no
     * lleva `budgetBytes` y el motor resuelve la ausencia con `DEFAULT_PAYLOAD_BUDGET_BYTES`.
     */
    private payloadBudget?: () => number
  ) {}

  async dispatch(subject: string, raw: unknown): Promise<Reply> {
    // `methodFromSubject` y no el `commandFromSubject` deprecado: con dos servicios en el bus el
    // quinto segmento es un método, no siempre un comando.
    const method = methodFromSubject(subject);
    // El caller se resuelve UNA VEZ y se reusa en el contexto: antes se calculaba inline dentro
    // de la llamada a `execute`, y la compuerta lo necesita antes.
    const caller = callerFromSubject(subject);

    // LAS DOS COMPUERTAS VAN ANTES DE RESOLVER EL MÉTODO (CA-6), igual que en el plano de comandos
    // y por el mismo motivo. Acá no hay transacción que proteger —este despachador no abre
    // ninguna, y las compuertas TAMPOCO, así que esa propiedad no se altera—: lo que se protege es
    // no tocar `readDb` ni decirle a un caller no autorizado si la consulta existe.
    //
    // EN UN DESPLIEGUE REAL EL CALLOUT YA RECHAZA PARTE DE ESTO EN EL TRANSPORTE (la plantilla del
    // conector externo no le da permiso sobre `jiku-queries`). Esta es la SEGUNDA vez que se dice,
    // y eso es exactamente lo que "defensa en profundidad" significa: un error en una plantilla no
    // alcanza por sí solo para leer la base.
    //
    // EL `try` ES NUEVO Y ES OBLIGATORIO. Hasta S-023 acá se llamaba a `authorizeCaller()`, que
    // trae su propio try/catch y por eso "nunca rechaza". Al inlinear las dos llamadas —para no
    // pagar dos `SELECT`— esa protección hay que TRAERLA ACÁ: `getTrustedPublisherId()` lanza si
    // `loadConfig()` no corrió y `readCallerRoles` puede rechazar (base caída, pool agotado), y
    // los dos ocurrirían fuera del `try` de más abajo. "El despachador nunca lanza" (ADR-003) no
    // admite un camino donde sí.
    let callerClass: CallerClass;
    try {
      // UN SOLO `SELECT` (CA-5): el mismo `roles` alimenta a las DOS compuertas.
      //
      // ACÁ NO HAY EXENCIÓN DE LA LECTURA, y es la diferencia deliberada con el plano de comandos:
      // la clase la necesita TODO caller, la api incluida (CA-8). En comandos el exento sigue sin
      // tocar la base porque allá no hay clase que resolver.
      const roles = await readCallerRoles(caller);

      // COMPUERTA 1 (S-017) — "¿puede ejecutar este método?", con su exención por `sub` INTACTA.
      const denied = authorizeWithRoles(caller, roles, method, 'queries');
      if (denied) {
        return denied;
      }

      // COMPUERTA 2 (S-023) — "¿qué le recorto?", y SIN exención para nadie.
      //
      // Son dos preguntas distintas y por eso son dos códigos: fusionarlas obligaría a mapear un
      // mismo código a dos causas y, más grave, borraría el criterio de que sin identidad la
      // respuesta tiene que ser un ERROR y nunca una lista vacía.
      //
      // HOY ESTE RECHAZO SOLO ES ALCANZABLE PARA EL CALLER EXENTO: cualquier otro caller sin clase
      // ya fue cortado por la compuerta 1, porque los únicos roles con `queries: ALL` son los tres
      // que SÍ tienen clase. Ver el comentario de `caller-class.ts`.
      const resolved = resolveCallerClass(roles);
      if (!resolved) {
        logger.warn(`[auth] queries: caller sin clase: ${caller} -> ${method}`);
        return failure(ErrorCode.UNKNOWN_CALLER, UNKNOWN_CALLER_MESSAGE);
      }
      callerClass = resolved;
    } catch (error: any) {
      // Igual que `authorizeCaller`: una compuerta que no puede decidir DENIEGA. Dejar pasar
      // convertiría una base caída en un bypass de autorización.
      //
      // Prefijo `[auth]` y no `[query]` porque es un fallo de la COMPUERTA, no de la consulta: es
      // lo que mantiene grepeable con una sola línea todo rechazo de autorización de los dos
      // planos.
      logger.error(`[auth] queries: no se pudo resolver el caller de ${method}: ${error.message}`);
      return failure(ErrorCode.INTERNAL_ERROR, 'Internal error');
    }

    const query = this.registry.resolve(method);

    if (!query) {
      logger.warn(`[query] consulta desconocida: ${method}`);
      return failure(ErrorCode.UNKNOWN_COMMAND, `Unknown query: ${method}`);
    }

    // SIN TRANSACCIÓN, y la ausencia es deliberada (RF-9): una lectura no necesita atomicidad y
    // una transacción por request tomaría y sostendría un snapshot por cada consulta. Si alguna
    // necesita consistencia entre varias lecturas, abre una READ ONLY explícita adentro.
    try {
      // LA VALIDACIÓN VA ANTES DE `execute` Y SIN TOCAR LA BASE (convención `validation`), que es
      // el mismo criterio por el que en el plano de comandos corre antes de abrir la transacción:
      // un payload inválido no puede costar una conexión del pool de lectura.
      const validated = query.validate(raw);
      if ('error' in validated) {
        return validated.error;
      }

      const ctx: QueryContext = { caller, callerClass, db: this.db };
      // La clave se agrega CONDICIONALMENTE: sin proveedor, el contexto es byte a byte el que
      // entregó S-013. Ver el comentario de `QueryContext.budgetBytes`.
      if (this.payloadBudget) {
        ctx.budgetBytes = this.payloadBudget();
      }

      return await query.execute(validated.value, ctx);
    } catch (error: any) {
      // Igual que el despachador de comandos: NUNCA LANZA. El `handle()` del servicio es la
      // última red, pero el detalle del error se loguea acá, donde se sabe QUÉ CONSULTA falló y
      // no solo qué subject.
      logger.error(`[query] ${method}: ${error.message}`);
      return failure(ErrorCode.INTERNAL_ERROR, 'Internal error');
    }
  }
}

export default QueryDispatcher;
