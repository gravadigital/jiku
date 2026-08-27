import { RequirementState, RequirementType } from '@jiku/models';

/**
 * LA TABLA DE TRANSICIONES DE ESTADO DEL REQUISITO (C-15, REQ-007 / S-033).
 *
 * C-15 NUNCA EXISTIÓ EN EL SERVIDOR: vivía únicamente en el stepper de `web`
 * (`RequirementStatusCard.tsx`), y por eso cualquier `user` podía llevar un requisito a
 * cualquier estado sin pasar por esa UI — el hueco que este archivo cierra. Misma forma que
 * `ROLE_PERMISSIONS` de S-030 (`authorize-caller.ts`): una constante de módulo,
 * DENY-BY-DEFAULT, dato y no código repartido en condicionales.
 *
 * LA SECUENCIA LINEAL (`SEQUENCE`) cubre el camino feliz:
 *
 *   analisis -> planificacion -> en_cola -> desarrollo -> revision
 *
 * DOS CASOS NO SIGUEN LA SECUENCIA LINEAL Y SE MODELAN COMO REGLAS APARTE, a propósito —
 * forzarlos dentro de `SEQUENCE` le haría perder la propiedad de "tabla simple" que CA-1 pide:
 *
 *   1. La excepción de `incidencia`: `planificacion -> desarrollo` saltea `en_cola`, pero SOLO
 *      cuando `type === 'incidencia'` (CA-3). La misma transición en una `funcionalidad` se
 *      rechaza (CA-4). El `type` se lee de la FILA, nunca del payload — ver H-4 del Story Plan:
 *      un caller no puede declararse incidencia para saltear un paso.
 *   2. `resuelto` por el camino de resolución: alcanzable desde CUALQUIER estado no terminal
 *      (CA-6 lo declara para `cancelado`; para `resuelto` el "camino de resolución" exige
 *      además tipo + conclusión — C-17, ver `RESOLUTION_REQUIRED` en los comandos que llaman a
 *      esta función). Esta tabla solo decide si la transición de ESTADO está permitida; la
 *      obligatoriedad de tipo+conclusión la aplica el caller (`requirements-edit.ts` /
 *      `requirements-resolve.ts`), no esta función.
 *
 * `cancelado` ES ALCANZABLE DESDE CUALQUIER ESTADO NO TERMINAL (CA-6): un requisito se cancela
 * cuando se cancela, no cuando la secuencia lo permite — no es una corrección de flujo, es una
 * salida de emergencia.
 *
 * EL RETROCESO DE UN PASO SE PERMITE (CA-5): `web` deja mover la tarjeta del tablero hacia
 * atrás, y prohibirlo convertiría una corrección cotidiana en un error. Se deriva comparando la
 * posición en `SEQUENCE`, no se declara como tabla inversa aparte.
 *
 * `resuelto` Y `cancelado` SON TERMINALES (CA-7): ninguna transición sale de ahí, ni siquiera
 * hacia `resuelto` de nuevo por el camino de resolución.
 */
const SEQUENCE: RequirementState[] = [
  RequirementState.Analisis,
  RequirementState.Planificacion,
  RequirementState.EnCola,
  RequirementState.Desarrollo,
  RequirementState.Revision,
];

const TERMINAL_STATES: readonly RequirementState[] = [
  RequirementState.Resuelto,
  RequirementState.Cancelado,
];

function isTerminal(state: RequirementState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * `true` cuando `from -> to` es un paso hacia adelante o hacia atrás en `SEQUENCE` (CA-5): la
 * distancia entre posiciones no importa, alcanza con que las dos estén en la secuencia lineal.
 * `resuelto` y `cancelado` no forman parte de `SEQUENCE`, así que nunca entran por acá.
 */
function isSequenceStep(from: RequirementState, to: RequirementState): boolean {
  const fromIndex = SEQUENCE.indexOf(from);
  const toIndex = SEQUENCE.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }
  return toIndex === fromIndex + 1 || toIndex === fromIndex - 1;
}

/**
 * La excepción de CA-3/CA-4: `planificacion -> desarrollo` saltea `en_cola`, SOLO para
 * `incidencia`. `type` se recibe ya leído de la fila (ver el comentario de arriba) — esta
 * función no sabe de dónde vino, solo lo usa.
 */
function isIncidenciaSkip(
  from: RequirementState,
  to: RequirementState,
  type: RequirementType | null | undefined
): boolean {
  return (
    from === RequirementState.Planificacion
    && to === RequirementState.Desarrollo
    && type === RequirementType.Incidencia
  );
}

/**
 * `true` cuando `from -> to` es una transición de estado permitida por la tabla.
 *
 * Función PURA: mismo input, mismo output, sin acceso a la base ni efectos laterales. No
 * conoce Joi, `Reply`, ni el modelo Sequelize — solo trabaja con los tres valores primitivos.
 *
 * NO decide la obligatoriedad de tipo+conclusión al resolver (C-17): eso es una regla del
 * caller (`requirements-edit.ts` / `requirements-resolve.ts`), no de esta tabla. Esta función
 * solo contesta "¿el estado de origen puede pasar a este estado de destino?".
 */
export function isTransitionAllowed(
  from: RequirementState,
  to: RequirementState,
  type: RequirementType | null | undefined
): boolean {
  // DENY-BY-DEFAULT: los estados terminales no tienen ninguna transición de salida (CA-7).
  if (isTerminal(from)) {
    return false;
  }

  // `cancelado` es alcanzable desde cualquier estado no terminal (CA-6).
  if (to === RequirementState.Cancelado) {
    return true;
  }

  // `resuelto` por el camino de resolución, desde cualquier estado no terminal. La
  // obligatoriedad de tipo+conclusión (C-17) la aplica el caller, no esta tabla.
  if (to === RequirementState.Resuelto) {
    return true;
  }

  if (isIncidenciaSkip(from, to, type)) {
    return true;
  }

  return isSequenceStep(from, to);
}

export default isTransitionAllowed;
