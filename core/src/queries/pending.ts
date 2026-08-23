import { ErrorCode, failure } from '@jiku/nats-protocol';
import { Query } from './types';

/**
 * Una consulta REGISTRADA Y SIN CONTRATO: existe, aparece en `nats micro info`, tiene queue group
 * y contadores, y CONTESTA. Es la definición de "listo" de esta story (CA-10): el endpoint
 * contesta, no *qué* contesta.
 *
 * El código es `unknown_command` y no uno nuevo A PROPÓSITO: un código nuevo hay que agregarlo en
 * TRES lugares —el paquete, `docs/apis/core.yaml` y el mapa a HTTP de la api— y los tres son
 * servicios que esta story declara intactos. `unknown_command` ya está declarado y ya mapea a 500,
 * que es lo honesto para "no hay implementación". El mensaje desambigua del otro emisor del mismo
 * código.
 *
 * El mensaje incluye el patrón, que es información del caller y no interna. NO incluye el subject
 * completo, que sí lleva el user id.
 *
 * TRANSITORIO: este archivo entero desaparece con el REQ del contrato de consultas, cuyo insumo
 * es `bus-api-consultas.md`.
 */
export function pendingContract(pattern: string): Query {
  return {
    pattern,
    execute: () =>
      Promise.resolve(
        failure(
          ErrorCode.UNKNOWN_COMMAND,
          `La consulta ${pattern} todavía no tiene contrato definido`
        )
      ),
  };
}

export default pendingContract;
