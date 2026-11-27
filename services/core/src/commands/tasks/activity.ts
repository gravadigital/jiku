/**
 * Helper para determinar la visibilidad de actividades en objetivos.
 *
 * Según las reglas de negocio de S-002:
 * - Cambios de estado, título y descripción son públicos (relevantes para clientes externos)
 * - Cambios operativos (área, persona, prioridad, fecha estimada) son internos
 * - Comentarios tienen visibilidad configurable (default: internal)
 */

import { activityVisibilityLevel } from '@jiku/models';

export type ActivityType = 'state' | 'area' | 'comment' | 'title' | 'person' | 'priority' | 'estimatedFinishDate' | 'description';

/**
 * Tipos de actividad que siempre son públicos (visibles para usuarios externos).
 * Cambios de estado, título y descripción son información relevante para clientes.
 */
const PUBLIC_ACTIVITY_TYPES: ActivityType[] = ['state', 'title', 'description'];

/**
 * Determina el nivel de visibilidad automático para un tipo de actividad.
 *
 * @param typeOfActivity - El tipo de actividad a evaluar
 * @returns 'public' para actividades visibles externamente, 'internal' para las demás
 *
 * Nota: Para comentarios ('comment'), esta función retorna 'internal' por defecto,
 * pero el valor puede ser sobrescrito por el usuario al crear el comentario.
 */
function getVisibilityForActivityType(typeOfActivity: ActivityType): activityVisibilityLevel {
  if (PUBLIC_ACTIVITY_TYPES.includes(typeOfActivity)) {
    return activityVisibilityLevel.Public;
  }
  return activityVisibilityLevel.Internal;
}

/**
 * Verifica si un tipo de actividad permite configuración manual de visibilidad.
 * Solo los comentarios permiten que el usuario elija la visibilidad.
 *
 * @param typeOfActivity - El tipo de actividad a evaluar
 * @returns true si el usuario puede elegir la visibilidad
 */
function isVisibilityConfigurable(typeOfActivity: ActivityType): boolean {
  return typeOfActivity === 'comment';
}

export {
  getVisibilityForActivityType,
  isVisibilityConfigurable,
};

/**
 * Igual que `getVisibilityForActivityType`, pero acepta el nombre del campo como string
 * suelto: en los comandos los campos se recorren dinámicamente.
 */
export function activityVisibility(field: string): activityVisibilityLevel {
  return getVisibilityForActivityType(field as ActivityType);
}
