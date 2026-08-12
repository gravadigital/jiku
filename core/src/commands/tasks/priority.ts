/**
 * `priority` de tasks: enum en el bus, entero en la base.
 *
 * El protocolo define prioridades por nombre (`sin_prioridad`, `baja`, ...), pero la
 * columna `objectives.priority` es INTEGER NOT NULL y la base no se toca. Core traduce,
 * igual que con `properties`.
 *
 * No confundir con `requirements.priority`, que SÍ es un enum en la base: esa tabla ya
 * migró (`20260529_03_requirement_priority_enum.js`). Esta traducción es solo para tasks.
 *
 * EL MAPEO
 * La api aceptaba 0-5 (`joi.number().min(0).max(5)`) y los tests usan los seis valores,
 * pero ningún lugar del código les da nombre: la web recibe el número, lo pasa entre
 * componentes y lo devuelve sin interpretarlo, así que no hay una semántica previa que
 * respetar. Se eligió el orden natural, dejando el 5 como alias de `urgente` para que
 * ningún dato existente quede sin traducción al leerlo.
 */
export enum TaskPriority {
  SinPrioridad = 'sin_prioridad',
  Baja = 'baja',
  Media = 'media',
  Alta = 'alta',
  Urgente = 'urgente',
}

export const TASK_PRIORITY_VALUES = Object.values(TaskPriority);

const TO_NUMBER: Record<TaskPriority, number> = {
  [TaskPriority.SinPrioridad]: 0,
  [TaskPriority.Baja]: 1,
  [TaskPriority.Media]: 2,
  [TaskPriority.Alta]: 3,
  [TaskPriority.Urgente]: 4,
};

/**
 * Escape para no perder información mientras la web siga hablando en números.
 *
 * El enum tiene 5 valores y la columna aceptaba 0-5, así que la traducción ida y vuelta
 * colapsaría el 5 en 4. La api manda el número original en `priorityValue` y core lo usa
 * tal cual; cuando la web pase a hablar en nombres, este campo desaparece.
 */
export function resolvePriority(
  name: TaskPriority | undefined,
  raw: number | undefined
): number | undefined {
  return raw !== undefined ? raw : priorityToNumber(name);
}

const FROM_NUMBER: Record<number, TaskPriority> = {
  0: TaskPriority.SinPrioridad,
  1: TaskPriority.Baja,
  2: TaskPriority.Media,
  3: TaskPriority.Alta,
  4: TaskPriority.Urgente,
  // 5 existe en datos previos: la api aceptaba hasta 5. Se lee como `urgente`.
  5: TaskPriority.Urgente,
};

export function priorityToNumber(priority: TaskPriority | undefined): number | undefined {
  return priority === undefined ? undefined : TO_NUMBER[priority];
}

/** Para cuando la api tenga que devolver el nombre. Un valor fuera de rango cae en `sin_prioridad`. */
export function priorityFromNumber(value: number | null | undefined): TaskPriority {
  if (value === null || value === undefined) {
    return TaskPriority.SinPrioridad;
  }
  return FROM_NUMBER[value] ?? TaskPriority.SinPrioridad;
}
