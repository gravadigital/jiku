export interface ReportObjectiveEntry {
  objectiveId: number | null;
  objectiveTitle: string | null;
  requirementId: number | null;
  requirementTitle: string | null;
  objectiveRequirementId: number | null;
  objectiveRequirementTitle: string | null;
  totalMinutes: number;
}

export interface RequirementGroup<T extends ReportObjectiveEntry> {
  requirementId: number;
  requirementTitle: string;
  direct: number;
  directEntry: T | null;
  tasks: T[];
}

export interface GroupedObjectives<T extends ReportObjectiveEntry> {
  requirementGroups: RequirementGroup<T>[];
  noRequirementTasks: T[];
  soloProjectEntries: T[];
}

/**
 * Clasifica el array plano de destinos de horas en 3 grupos, siguiendo la
 * exclusividad ya validada en backend (objetivo/requisito mutuamente
 * excluyentes en worked_times):
 * - objectiveId == null && requirementId != null -> horas directas del requisito ("direct").
 * - objectiveId != null && objectiveRequirementId != null -> tarea vinculada a ese requisito.
 * - objectiveId != null && objectiveRequirementId == null -> tarea sin requisito.
 * - objectiveId == null && requirementId == null -> solo-proyecto, se devuelve intacta
 *   para que el caller la renderice igual que antes (no entra en la reagrupación).
 */
export function groupObjectivesByRequirement<T extends ReportObjectiveEntry>(
  objectives: T[]
): GroupedObjectives<T> {
  const groupsByRequirementId = new Map<number, RequirementGroup<T>>();
  const noRequirementTasks: T[] = [];
  const soloProjectEntries: T[] = [];

  // requirementTitle solo viene poblado en la entry de horas DIRECTAS al requisito
  // (FK requirementId de worked_time). En una entry de tarea, el título del
  // requisito vinculado viene en objectiveRequirementTitle (join objective->requirement,
  // agregado en el fix de S-070 sobre el backend de S-069). Si ninguna de las dos
  // fuentes trae título (dato legacy/edge case), se usa "Requisito #{id}" como fallback.
  const getOrCreateGroup = (requirementId: number): RequirementGroup<T> => {
    const existing = groupsByRequirementId.get(requirementId);
    if (existing) return existing;
    const created: RequirementGroup<T> = {
      requirementId,
      requirementTitle: `Requisito #${requirementId}`,
      direct: 0,
      directEntry: null,
      tasks: [],
    };
    groupsByRequirementId.set(requirementId, created);
    return created;
  };

  for (const entry of objectives) {
    if (entry.objectiveId == null && entry.requirementId != null) {
      const group = getOrCreateGroup(entry.requirementId);
      if (entry.requirementTitle) group.requirementTitle = entry.requirementTitle;
      group.direct += entry.totalMinutes;
      group.directEntry = entry;
      continue;
    }

    if (entry.objectiveId != null && entry.objectiveRequirementId != null) {
      const group = getOrCreateGroup(entry.objectiveRequirementId);
      if (entry.objectiveRequirementTitle) group.requirementTitle = entry.objectiveRequirementTitle;
      group.tasks.push(entry);
      continue;
    }

    if (entry.objectiveId != null && entry.objectiveRequirementId == null) {
      noRequirementTasks.push(entry);
      continue;
    }

    soloProjectEntries.push(entry);
  }

  return {
    requirementGroups: Array.from(groupsByRequirementId.values()),
    noRequirementTasks,
    soloProjectEntries,
  };
}
