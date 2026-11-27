import type { CreateWorkedTimePayload, TargetSelection } from '../types/worked-time.types';

/**
 * Arma el payload de POST /worked-times eligiendo el destino más específico
 * de la selección en árbol (objetivo > requisito > proyecto):
 * - Si hay objetivo → se envía `objectiveId` (sin `requirementId`).
 * - Si no, si hay requisito → se envía `requirementId` (sin `objectiveId`).
 * - Si no, solo `projectId`.
 *
 * El `projectId` se toma de `resolvedProjectId`, que el caller deriva del nivel
 * más profundo elegido (objetivo o requisito) cuando el usuario no eligió un
 * proyecto explícito en la UI.
 *
 * Garantiza la exclusión backend `objectiveId` ↔ `requirementId` (nunca ambos).
 * Devuelve `null` si no hay un `projectId` válido (destino mínimo).
 */
export function buildWorkedTimePayload(
  selection: TargetSelection | null,
  date: string,
  minutes: number,
  personId?: number,
  resolvedProjectId?: number | null
): CreateWorkedTimePayload | null {
  if (!selection) return null;

  const projectId = resolvedProjectId ?? selection.projectId;
  if (projectId == null) return null;

  const payload: CreateWorkedTimePayload = {
    date,
    minutes,
    projectId,
  };

  if (selection.objectiveId != null) {
    payload.objectiveId = selection.objectiveId;
  } else if (selection.requirementId != null) {
    payload.requirementId = selection.requirementId;
  }

  if (personId != null) {
    payload.personId = personId;
  }

  return payload;
}
