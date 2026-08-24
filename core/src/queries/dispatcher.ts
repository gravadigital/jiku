import { Sequelize } from 'sequelize-typescript';
import {
  ErrorCode,
  Reply,
  callerFromSubject,
  failure,
  methodFromSubject,
} from '@jiku/nats-protocol';
import { authorizeCaller } from '../authorize-caller';
import logger from '../logger';
import { QueryRegistry } from './registry';

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
    private db: Sequelize
  ) {}

  async dispatch(subject: string, raw: unknown): Promise<Reply> {
    // `methodFromSubject` y no el `commandFromSubject` deprecado: con dos servicios en el bus el
    // quinto segmento es un método, no siempre un comando.
    const method = methodFromSubject(subject);
    // El caller se resuelve UNA VEZ y se reusa en el contexto: antes se calculaba inline dentro
    // de la llamada a `execute`, y la compuerta lo necesita antes.
    const caller = callerFromSubject(subject);

    // LA COMPUERTA VA ANTES DE RESOLVER EL MÉTODO (CA-6), igual que en el plano de comandos y por
    // el mismo motivo. Acá no hay transacción que proteger —este despachador no abre ninguna, y
    // la compuerta TAMPOCO, así que esa propiedad no se altera—: lo que se protege es no tocar
    // `readDb` ni decirle a un caller no autorizado si la consulta existe.
    //
    // EN UN DESPLIEGUE REAL EL CALLOUT YA RECHAZA ESTO EN EL TRANSPORTE (la plantilla del conector
    // externo no le da permiso sobre `jiku-queries`). Esta línea es la SEGUNDA vez que se dice, y
    // eso es exactamente lo que "defensa en profundidad" significa: un error en una plantilla no
    // alcanza por sí solo para leer la base.
    const denied = await authorizeCaller(caller, method, 'queries');
    if (denied) {
      return denied;
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
      return await query.execute(raw, { caller, db: this.db });
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
