/**
 * `priority` de tasks: número en el contrato HTTP, enum en el bus.
 *
 * La web manda y recibe un número (0-5) porque su contrato no cambia. El protocolo del
 * bus usa nombres. Core hace la conversión inversa al escribir, porque la columna
 * `objectives.priority` sigue siendo INTEGER.
 *
 * El mapeo tiene que coincidir con `core/src/commands/tasks/priority.ts`.
 */
const NAMES = ['sin_prioridad', 'baja', 'media', 'alta', 'urgente'] as const;

export type TaskPriorityName = (typeof NAMES)[number];

export function priorityToName(value: number | undefined | null): TaskPriorityName | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  // El rango aceptado es 0-5: el 5 se trata como `urgente`, igual que en core.
  return NAMES[Math.min(value, NAMES.length - 1)] ?? 'sin_prioridad';
}
