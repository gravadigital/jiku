import { describe, expect, it } from 'vitest';
import {
  filterReportByPerson,
  filterReportByProject,
  matchesProjectType,
} from './projectTypeFilter';
import type { ReportByPerson, ReportByProject } from '../types/worked-time.types';

describe('matchesProjectType — S-071/TS-1 (selección vacía = "Todos")', () => {
  it('retorna true para cualquier tipo (incluido undefined) cuando selectedTypes está vacío', () => {
    expect(matchesProjectType('comercial', [])).toBe(true);
    expect(matchesProjectType('interno', [])).toBe(true);
    expect(matchesProjectType('investigacion', [])).toBe(true);
    expect(matchesProjectType('propuesta', [])).toBe(true);
    expect(matchesProjectType(undefined, [])).toBe(true);
  });
});

describe('matchesProjectType — S-071/TS-2 (un tipo tildado)', () => {
  it('retorna true solo para el tipo tildado', () => {
    expect(matchesProjectType('comercial', ['comercial'])).toBe(true);
    expect(matchesProjectType('interno', ['comercial'])).toBe(false);
  });
});

describe('matchesProjectType — S-071/TS-3 (combinación de 2 tipos tildados)', () => {
  it('retorna true para ambos tipos tildados, false para el resto', () => {
    expect(matchesProjectType('investigacion', ['comercial', 'investigacion'])).toBe(true);
    expect(matchesProjectType('comercial', ['comercial', 'investigacion'])).toBe(true);
    expect(matchesProjectType('propuesta', ['comercial', 'investigacion'])).toBe(false);
    expect(matchesProjectType('interno', ['comercial', 'investigacion'])).toBe(false);
  });
});

describe('matchesProjectType — S-071/TS-4 (type undefined con selección activa)', () => {
  it('retorna false cuando type es undefined y hay tipos tildados', () => {
    expect(matchesProjectType(undefined, ['comercial'])).toBe(false);
  });
});

describe('filterReportByPerson — S-071/TS-5,TS-6 (selección múltiple)', () => {
  const dataByPerson: ReportByPerson[] = [
    {
      personId: 1,
      personFirstName: 'Ivan',
      personLastName: 'Maldonado',
      totalMinutes: 150,
      projects: [
        {
          projectId: 1,
          projectName: 'Verifarma',
          projectCode: 'CL',
          totalMinutes: 100,
          objectives: [],
        },
        {
          projectId: 2,
          projectName: 'Interno Grava',
          projectCode: 'INT',
          totalMinutes: 50,
          objectives: [],
        },
      ],
    },
    {
      personId: 2,
      personFirstName: 'Ana',
      personLastName: 'Gomez',
      totalMinutes: 40,
      projects: [
        {
          projectId: 2,
          projectName: 'Interno Grava',
          projectCode: 'INT',
          totalMinutes: 40,
          objectives: [],
        },
      ],
    },
  ];

  const projectTypeMap = new Map([
    [1, 'comercial' as const],
    [2, 'interno' as const],
  ]);

  it('TS-5: con selección vacía retorna los datos sin cambios', () => {
    const result = filterReportByPerson(dataByPerson, projectTypeMap, []);

    expect(result).toEqual(dataByPerson);
  });

  it('TS-6: con 1 tipo tildado excluye los demás y recalcula totalMinutes', () => {
    const result = filterReportByPerson(dataByPerson, projectTypeMap, ['comercial']);

    expect(result).toHaveLength(1);
    expect(result?.[0]).toMatchObject({
      personId: 1,
      totalMinutes: 100,
      projects: [{ projectId: 1, projectCode: 'CL', totalMinutes: 100 }],
    });
  });

  it('excluye completamente a una persona cuyo total filtrado sea 0', () => {
    const result = filterReportByPerson(dataByPerson, projectTypeMap, ['comercial']);

    expect(result?.find((p) => p.personId === 2)).toBeUndefined();
  });

  it('retorna undefined cuando data es undefined', () => {
    expect(filterReportByPerson(undefined, projectTypeMap, ['comercial'])).toBeUndefined();
  });

  it('excluye proyecto no presente en projectTypeMap con selección activa pero lo incluye sin selección', () => {
    const dataConNoClasificado: ReportByPerson[] = [
      {
        personId: 1,
        personFirstName: 'Ivan',
        personLastName: 'Maldonado',
        totalMinutes: 30,
        projects: [
          {
            projectId: 99,
            projectName: 'Desconocido',
            projectCode: 'XX',
            totalMinutes: 30,
            objectives: [],
          },
        ],
      },
    ];

    expect(filterReportByPerson(dataConNoClasificado, projectTypeMap, [])).toEqual(
      dataConNoClasificado
    );
    expect(filterReportByPerson(dataConNoClasificado, projectTypeMap, ['comercial'])).toEqual([]);
  });
});

describe('filterReportByProject — S-071/TS-7,TS-8 (selección múltiple)', () => {
  const dataByProject: ReportByProject[] = [
    {
      projectId: 1,
      projectName: 'Verifarma',
      projectCode: 'CL',
      totalMinutes: 60,
      objectives: [],
      persons: [],
    },
    {
      projectId: 2,
      projectName: 'Interno Grava',
      projectCode: 'INT',
      totalMinutes: 40,
      objectives: [],
      persons: [
        { personId: 1, personFirstName: 'Ivan', personLastName: 'Maldonado', totalMinutes: 40 },
      ],
    },
    {
      projectId: 3,
      projectName: 'I+D Nuevas Tecnologias',
      projectCode: 'INV',
      totalMinutes: 30,
      objectives: [],
      persons: [{ personId: 2, personFirstName: 'Ana', personLastName: 'Gomez', totalMinutes: 30 }],
    },
    {
      projectId: 4,
      projectName: 'Propuesta Cliente X',
      projectCode: 'PRO',
      totalMinutes: 20,
      objectives: [],
      persons: [
        { personId: 1, personFirstName: 'Ivan', personLastName: 'Maldonado', totalMinutes: 20 },
      ],
    },
  ];

  const projectTypeMap = new Map([
    [1, 'comercial' as const],
    [2, 'interno' as const],
    [3, 'investigacion' as const],
    [4, 'propuesta' as const],
  ]);

  it('TS-7: con 1 tipo tildado retorna solo el proyecto de ese tipo', () => {
    const result = filterReportByProject(dataByProject, projectTypeMap, ['propuesta']);

    expect(result?.map((p) => p.projectId)).toEqual([4]);
  });

  it('con combinación de tipos retorna los proyectos de esos tipos', () => {
    const result = filterReportByProject(dataByProject, projectTypeMap, [
      'interno',
      'investigacion',
      'propuesta',
    ]);

    expect(result?.map((p) => p.projectId)).toEqual([2, 3, 4]);
  });

  it('con selección vacía retorna los datos sin cambios', () => {
    expect(filterReportByProject(dataByProject, projectTypeMap, [])).toEqual(dataByProject);
  });

  it('retorna undefined cuando data es undefined', () => {
    expect(filterReportByProject(undefined, projectTypeMap, ['comercial'])).toBeUndefined();
  });

  it('TS-8: excluye ausencias (proyecto no clasificado, ej. projectCode AUS) con selección activa pero las incluye sin selección', () => {
    const dataConAusencias: ReportByProject[] = [
      {
        projectId: 1,
        projectName: 'Verifarma',
        projectCode: 'CL',
        totalMinutes: 50,
        objectives: [],
        persons: [],
      },
      {
        projectId: 0,
        projectName: 'Ausencias',
        projectCode: 'AUS',
        totalMinutes: 30,
        objectives: [],
        persons: [],
      },
    ];

    const filtered = filterReportByProject(dataConAusencias, projectTypeMap, ['comercial']);
    expect(filtered?.map((p) => p.projectId)).toEqual([1]);

    const unfiltered = filterReportByProject(dataConAusencias, projectTypeMap, []);
    expect(unfiltered).toEqual(dataConAusencias);
  });
});
