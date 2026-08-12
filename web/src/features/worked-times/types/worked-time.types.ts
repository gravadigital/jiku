export interface WorkedTimeEntry {
  id: number;
  date: string;
  minutes: number;
  projectId: number;
  project?: { id: number; name: string; code: string };
  objectiveId?: number | null;
  objective?: { id: number; title: string } | null;
  requirementId?: number | null;
  requirement?: { id: number; title: string } | null;
  personId: number;
  createdAt: string;
}

export interface PersonObjective {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  requirementId: number | null;
}

export interface PersonRequirement {
  id: number;
  title: string;
  state: string;
  projectId: number;
  projectName: string;
}

/**
 * Estado del selector de destino en árbol Proyecto → Requisito → Objetivo.
 * Los tres niveles pueden coexistir; el destino enviado al backend es el
 * nivel más específico elegido (objetivo > requisito > proyecto).
 */
export interface TargetSelection {
  projectId: number | null;
  projectName?: string;
  requirementId: number | null;
  objectiveId: number | null;
}

export interface CreateWorkedTimePayload {
  date: string;
  minutes: number;
  projectId: number;
  objectiveId?: number;
  requirementId?: number;
  personId?: number;
}

export interface ReportByPerson {
  personId: number;
  personFirstName: string;
  personLastName: string;
  totalMinutes: number;
  projects: Array<{
    projectId: number;
    projectName: string;
    projectCode: string;
    totalMinutes: number;
    objectives: Array<{
      objectiveId: number | null;
      objectiveTitle: string | null;
      requirementId: number | null;
      requirementTitle: string | null;
      objectiveRequirementId: number | null;
      objectiveRequirementTitle: string | null;
      totalMinutes: number;
    }>;
  }>;
}

export interface ReportPerson {
  personId: number;
  personFirstName: string;
  personLastName: string;
  totalMinutes: number;
}

export interface ReportByProject {
  projectId: number;
  projectName: string;
  projectCode: string;
  totalMinutes: number;
  objectives: Array<{
    objectiveId: number | null;
    objectiveTitle: string | null;
    requirementId: number | null;
    requirementTitle: string | null;
    objectiveRequirementId: number | null;
    objectiveRequirementTitle: string | null;
    totalMinutes: number;
    persons: ReportPerson[];
  }>;
  persons: ReportPerson[];
}
