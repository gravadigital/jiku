import { describe, it, expect } from 'vitest';
import { groupObjectivesByRequirement } from './groupObjectivesByRequirement';

describe('groupObjectivesByRequirement', () => {
  // TS-1: Requisito con horas directas y 2 tareas vinculadas
  it('CA-1/TS-1: agrupa horas directas del requisito en "direct" y las tareas vinculadas en "tasks"', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: null,
        objectiveTitle: null,
        requirementId: 5,
        requirementTitle: 'Login SSO',
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 60,
      },
      {
        objectiveId: 1,
        objectiveTitle: 'Fix bug',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 40,
      },
      {
        objectiveId: 2,
        objectiveTitle: '2FA',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 20,
      },
    ]);

    expect(result.requirementGroups).toHaveLength(1);
    const group = result.requirementGroups[0];
    expect(group.requirementId).toBe(5);
    expect(group.requirementTitle).toBe('Login SSO');
    expect(group.direct).toBe(60);
    expect(group.tasks).toHaveLength(2);
    expect(group.tasks.map((t) => t.objectiveId).sort()).toEqual([1, 2]);
  });

  // TS-1b: la entry de horas directas se preserva completa en directEntry (para desglose por persona en by-project)
  it('CA-1/TS-1b: directEntry conserva la entry original de horas directas, incluyendo persons', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: null,
        objectiveTitle: null,
        requirementId: 5,
        requirementTitle: 'Login SSO',
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 60,
        persons: [
          { personId: 1, personFirstName: 'Ivan', personLastName: 'Maldonado', totalMinutes: 60 },
        ],
      },
    ]);

    const group = result.requirementGroups[0];
    expect(group.directEntry).not.toBeNull();
    expect(group.directEntry?.persons).toEqual([
      { personId: 1, personFirstName: 'Ivan', personLastName: 'Maldonado', totalMinutes: 60 },
    ]);
  });

  it('directEntry es null cuando el requisito no tiene horas directas', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: 1,
        objectiveTitle: 'Fix bug',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 40,
      },
    ]);

    expect(result.requirementGroups[0].directEntry).toBeNull();
  });

  // TS-2: Requisito sin horas directas, con tareas vinculadas — usa objectiveRequirementTitle (fix backend S-070)
  it('CA-2/TS-2: un requisito sin horas directas tiene direct === 0 y usa el título real vía objectiveRequirementTitle', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: 1,
        objectiveTitle: 'Fix bug',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 40,
      },
    ]);

    expect(result.requirementGroups).toHaveLength(1);
    expect(result.requirementGroups[0].direct).toBe(0);
    expect(result.requirementGroups[0].requirementTitle).toBe('Login SSO');
    expect(result.requirementGroups[0].tasks).toHaveLength(1);
  });

  // TS-2b: si ni requirementTitle ni objectiveRequirementTitle vienen poblados, se usa el fallback "Requisito #{id}"
  it('CA-2/TS-2b: sin título disponible en ninguna entry, usa fallback "Requisito #{id}"', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: 1,
        objectiveTitle: 'Fix bug',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: null,
        totalMinutes: 40,
      },
    ]);

    expect(result.requirementGroups).toHaveLength(1);
    expect(result.requirementGroups[0].requirementTitle).toBe('Requisito #5');
  });

  // TS-3: Tarea sin requisito asociado
  it('CA-3/TS-3: una tarea sin objectiveRequirementId va a noRequirementTasks', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: 1,
        objectiveTitle: 'Suelta',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 30,
      },
    ]);

    expect(result.requirementGroups).toHaveLength(0);
    expect(result.noRequirementTasks).toHaveLength(1);
    expect(result.noRequirementTasks[0].objectiveTitle).toBe('Suelta');
  });

  // TS-4: Horas solo-proyecto se preservan aparte, sin agrupar
  it('CA-4/TS-4: una entry solo-proyecto (objectiveId y requirementId null) se devuelve en soloProject sin agrupar', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: null,
        objectiveTitle: null,
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 20,
      },
    ]);

    expect(result.requirementGroups).toHaveLength(0);
    expect(result.noRequirementTasks).toHaveLength(0);
    expect(result.soloProjectEntries).toHaveLength(1);
    expect(result.soloProjectEntries[0].totalMinutes).toBe(20);
  });

  // TS-7: Total del nodo de requisito = directas + suma de tareas, sin doble conteo
  it('CA-6/TS-7: el total de un grupo de requisito es direct + suma de tasks', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: null,
        objectiveTitle: null,
        requirementId: 5,
        requirementTitle: 'Login SSO',
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 60,
      },
      {
        objectiveId: 1,
        objectiveTitle: 'Fix bug',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 40,
      },
      {
        objectiveId: 2,
        objectiveTitle: '2FA',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 20,
      },
    ]);

    const group = result.requirementGroups[0];
    const total = group.direct + group.tasks.reduce((sum, t) => sum + t.totalMinutes, 0);
    expect(total).toBe(120);
  });

  // TS-8: Requisito sin ninguna hora no genera nodo
  it('CA-7/TS-8: un requirementId que no aparece en el input no genera ningún grupo', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: 1,
        objectiveTitle: 'Otra tarea',
        requirementId: null,
        requirementTitle: 'Otro req',
        objectiveRequirementId: 3,
        objectiveRequirementTitle: 'Otro req',
        totalMinutes: 10,
      },
    ]);

    expect(result.requirementGroups.find((g) => g.requirementId === 9)).toBeUndefined();
  });

  // TS-9: clasifica los 4 casos correctamente en una sola pasada
  it('CA-1/CA-2/CA-3/CA-4/TS-9: clasifica correctamente una mezcla de los 4 tipos de entry', () => {
    const result = groupObjectivesByRequirement([
      {
        objectiveId: null,
        objectiveTitle: null,
        requirementId: 5,
        requirementTitle: 'Login SSO',
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 60,
      },
      {
        objectiveId: 1,
        objectiveTitle: 'Fix bug',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: 5,
        objectiveRequirementTitle: 'Login SSO',
        totalMinutes: 40,
      },
      {
        objectiveId: 2,
        objectiveTitle: 'Suelta',
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 30,
      },
      {
        objectiveId: null,
        objectiveTitle: null,
        requirementId: null,
        requirementTitle: null,
        objectiveRequirementId: null,
        objectiveRequirementTitle: null,
        totalMinutes: 20,
      },
    ]);

    expect(result.requirementGroups).toHaveLength(1);
    expect(result.requirementGroups[0].requirementId).toBe(5);
    expect(result.requirementGroups[0].direct).toBe(60);
    expect(result.requirementGroups[0].tasks).toHaveLength(1);
    expect(result.noRequirementTasks).toHaveLength(1);
    expect(result.noRequirementTasks[0].objectiveTitle).toBe('Suelta');
    expect(result.soloProjectEntries).toHaveLength(1);
    expect(result.soloProjectEntries[0].totalMinutes).toBe(20);
  });
});
