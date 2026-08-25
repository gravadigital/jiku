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
 * TRANSITORIO: este archivo entero desaparece en S-028, la story que cierra el contrato y deja a
 * los 18 recursos con ficha. Mientras quede UN endpoint sin contrato, el stub sigue acá: desde
 * S-022 son cuatro (`projects.list/get`, `comments.list/get`), y los va bajando S-024 y S-025.
 */
export function pendingContract(pattern: string): Query {
  return {
    pattern,
    // ACEPTA CUALQUIER PAYLOAD, y es lo correcto: un stub sin contrato no tiene forma que
    // validar, y rechazar acá diría que el endpoint SÍ tiene contrato y el payload no lo cumple.
    // Lo que contesta es "todavía no hay contrato", con cualquier cuerpo (TS-19 de S-013).
    validate: (payload: unknown) => ({ value: payload }),
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
