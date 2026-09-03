import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { usePersonObjectives } from '../../hooks/usePersonObjectives';
import { usePersonRequirements } from '../../hooks/usePersonRequirements';
import { TargetSelector } from './TargetSelector';

vi.mock('@/features/projects/hooks/useProjects', () => ({ useProjects: vi.fn() }));
vi.mock('../../hooks/usePersonRequirements', () => ({ usePersonRequirements: vi.fn() }));
vi.mock('../../hooks/usePersonObjectives', () => ({ usePersonObjectives: vi.fn() }));

const mockedUseProjects = vi.mocked(useProjects);
const mockedUsePersonRequirements = vi.mocked(usePersonRequirements);
const mockedUsePersonObjectives = vi.mocked(usePersonObjectives);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asQuery = (data: unknown) => ({ data }) as any;

const PROJECTS = [{ id: 1, name: 'Alpha', code: 'A' }];
const REQUIREMENTS = [
  { id: 5, title: 'R5', state: 'analisis', projectId: 1, projectName: 'Alpha' },
];
const OBJECTIVES = [{ id: 10, title: 'O1', projectId: 1, projectName: 'Alpha', requirementId: 5 }];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseProjects.mockReturnValue(asQuery(PROJECTS));
  mockedUsePersonRequirements.mockReturnValue(asQuery(REQUIREMENTS));
  mockedUsePersonObjectives.mockReturnValue(asQuery(OBJECTIVES));
});

const openSelect = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('combobox', { name: 'Proyecto / Requisito / Tarea' }));
};

describe('TargetSelector', () => {
  it('TS-1: agrupa las opciones por tipo (Proyectos / Requisitos / Tareas) en el label', async () => {
    const user = userEvent.setup();
    render(<TargetSelector personId={1} value={null} onSelect={vi.fn()} />);

    await openSelect(user);

    expect(screen.getByRole('option', { name: /Proyectos.*Alpha \(A\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Requisitos.*R5 — Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Tareas.*O1 → Alpha/ })).toBeInTheDocument();
  });

  it('TS-2: elegir un requisito resuelve projectId + requirementId', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TargetSelector personId={1} value={null} onSelect={onSelect} />);

    await openSelect(user);
    await user.click(screen.getByRole('option', { name: /Requisitos.*R5 — Alpha/ }));

    expect(onSelect).toHaveBeenCalledWith({
      projectId: 1,
      requirementId: 5,
      objectiveId: null,
    });
  });

  it('TS-3: elegir una tarea resuelve projectId + objectiveId, sin requirementId aunque pertenezca a un requisito', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TargetSelector personId={1} value={null} onSelect={onSelect} />);

    await openSelect(user);
    await user.click(screen.getByRole('option', { name: /Tareas.*O1 → Alpha/ }));

    expect(onSelect).toHaveBeenCalledWith({
      projectId: 1,
      requirementId: null,
      objectiveId: 10,
    });
  });

  it('TS-4: elegir solo un proyecto', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TargetSelector personId={1} value={null} onSelect={onSelect} />);

    await openSelect(user);
    await user.click(screen.getByRole('option', { name: /Proyectos.*Alpha \(A\)/ }));

    expect(onSelect).toHaveBeenCalledWith({
      projectId: 1,
      projectName: 'Alpha',
      requirementId: null,
      objectiveId: null,
    });
  });

  it('TS-6: cambiar de destino reemplaza la selección previa sin mezclar campos', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockedUseProjects.mockReturnValue(
      asQuery([
        { id: 1, name: 'Alpha', code: 'A' },
        { id: 2, name: 'Gamma', code: 'G' },
      ])
    );
    mockedUsePersonObjectives.mockReturnValue(
      asQuery([{ id: 20, title: 'O2', projectId: 2, projectName: 'Gamma', requirementId: null }])
    );

    render(
      <TargetSelector
        personId={1}
        value={{ projectId: 1, requirementId: 5, objectiveId: null }}
        onSelect={onSelect}
      />
    );

    await openSelect(user);
    await user.click(screen.getByRole('option', { name: /Tareas.*O2 → Gamma/ }));

    expect(onSelect).toHaveBeenCalledWith({
      projectId: 2,
      requirementId: null,
      objectiveId: 20,
    });
  });

  // S-093 (CA-1, TS-1): requisito fuera del límite anterior de 20 (useRequirements paginado)
  // aparece en la búsqueda porque ahora viene de usePersonRequirements, sin paginación
  it('S-093 TS-1: requisito antiguo (fuera del límite de 20 anterior) aparece en la lista', async () => {
    const user = userEvent.setup();
    mockedUsePersonRequirements.mockReturnValue(
      asQuery([
        {
          id: 142,
          title: 'REQ antiguo',
          state: 'desarrollo',
          projectId: 3,
          projectName: 'Proyecto Beta',
        },
      ])
    );

    render(<TargetSelector personId={7} value={null} onSelect={vi.fn()} />);
    await openSelect(user);

    expect(
      screen.getByRole('option', { name: /Requisitos.*REQ antiguo — Proyecto Beta/ })
    ).toBeInTheDocument();
  });

  // S-093 (CA-4, TS-4): caso admin — usePersonRequirements se invoca con el personId de la persona seleccionada
  it('S-093 TS-4: usePersonRequirements se invoca con el personId recibido por prop (caso admin)', () => {
    render(<TargetSelector personId={99} value={null} onSelect={vi.fn()} />);

    expect(mockedUsePersonRequirements).toHaveBeenCalledWith(99);
  });

  // S-093 (CA-3, TS-5): cambiar personId (re-render) invoca usePersonRequirements con el nuevo valor
  it('S-093 TS-5: cambiar personId invoca usePersonRequirements con el nuevo valor', () => {
    const { rerender } = render(<TargetSelector personId={99} value={null} onSelect={vi.fn()} />);
    expect(mockedUsePersonRequirements).toHaveBeenCalledWith(99);

    rerender(<TargetSelector personId={50} value={null} onSelect={vi.fn()} />);
    expect(mockedUsePersonRequirements).toHaveBeenCalledWith(50);
  });

  it('TS-83: no usa react-select ni selectStyles — usa el Select del DS', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './TargetSelector.tsx'), 'utf8');
    expect(content).not.toMatch(/selectStyles/);
    expect(content).not.toMatch(/from 'react-select'/);
  });
});
