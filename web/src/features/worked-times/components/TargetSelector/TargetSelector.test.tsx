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

/**
 * react-select se reemplaza por un <select> nativo con <optgroup> por cada grupo
 * de options, para que la elección de una opción específica sea determinista en
 * jsdom. Cada <option> usa como value un ID prefijado por tipo (`project-1`,
 * `requirement-5`, `objective-10`) para poder ubicarla sin ambigüedad entre grupos.
 */
vi.mock('react-select', () => ({
  default: ({
    options,
    value,
    onChange,
    noOptionsMessage,
  }: {
    options: Array<{ label: string; options: Array<{ value: string; label: string }> }>;
    value: { value: string; label: string } | null;
    onChange: (opt: { value: string; label: string } | null) => void;
    noOptionsMessage?: () => string;
  }) => {
    const allOptions = options.flatMap((g) => g.options);
    const hasNoOptions = allOptions.length === 0;
    return (
      <div>
        <select
          aria-label="Proyecto / Requisito / Tarea"
          value={value ? value.value : ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              onChange(null);
              return;
            }
            const opt = allOptions.find((o) => o.value === v) ?? null;
            onChange(opt);
          }}
        >
          <option value="" />
          {options.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {hasNoOptions && <span>{noOptionsMessage?.()}</span>}
      </div>
    );
  },
}));

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

const destinoSelect = () => screen.getByLabelText('Proyecto / Requisito / Tarea');

describe('TargetSelector', () => {
  it('TS-1: agrupa las opciones por tipo (Proyectos / Requisitos / Tareas)', () => {
    render(<TargetSelector personId={1} value={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Alpha (A)')).toBeInTheDocument();
    expect(screen.getByText('R5 — Alpha')).toBeInTheDocument();
    expect(screen.getByText('O1 → Alpha')).toBeInTheDocument();

    const groupLabels = Array.from(destinoSelect().querySelectorAll('optgroup')).map((g) =>
      g.getAttribute('label')
    );
    expect(groupLabels).toEqual(['Proyectos', 'Requisitos', 'Tareas']);
  });

  it('TS-2: elegir un requisito resuelve projectId + requirementId', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TargetSelector personId={1} value={null} onSelect={onSelect} />);

    await user.selectOptions(destinoSelect(), 'requirement-5');

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

    await user.selectOptions(destinoSelect(), 'objective-10');

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

    await user.selectOptions(destinoSelect(), 'project-1');

    expect(onSelect).toHaveBeenCalledWith({
      projectId: 1,
      projectName: 'Alpha',
      requirementId: null,
      objectiveId: null,
    });
  });

  it('TS-5: sin resultados muestra "Sin resultados"', () => {
    mockedUseProjects.mockReturnValue(asQuery([]));
    mockedUsePersonRequirements.mockReturnValue(asQuery([]));
    mockedUsePersonObjectives.mockReturnValue(asQuery([]));

    render(<TargetSelector personId={1} value={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
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

    await user.selectOptions(destinoSelect(), 'objective-20');

    expect(onSelect).toHaveBeenCalledWith({
      projectId: 2,
      requirementId: null,
      objectiveId: 20,
    });
  });

  // S-093 (CA-1, TS-1): requisito fuera del límite anterior de 20 (useRequirements paginado)
  // aparece en la búsqueda porque ahora viene de usePersonRequirements, sin paginación
  it('S-093 TS-1: requisito antiguo (fuera del límite de 20 anterior) aparece en la búsqueda', () => {
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

    expect(screen.getByText('REQ antiguo — Proyecto Beta')).toBeInTheDocument();
  });

  // S-093 (CA-1, TS-2): agrupación y label de requisitos con el nuevo shape (projectName plano)
  it('S-093 TS-2: agrupa requisitos bajo "Requisitos" con label "{título} — {proyecto}"', () => {
    mockedUsePersonRequirements.mockReturnValue(
      asQuery([
        { id: 5, title: 'Bug X', state: 'analisis', projectId: 1, projectName: 'Proyecto Alpha' },
      ])
    );

    render(<TargetSelector personId={7} value={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Bug X — Proyecto Alpha')).toBeInTheDocument();
    const groupLabels = Array.from(destinoSelect().querySelectorAll('optgroup')).map((g) =>
      g.getAttribute('label')
    );
    expect(groupLabels).toContain('Requisitos');
  });

  // S-093 (CA-2, TS-4): caso admin — usePersonRequirements se invoca con el personId de la persona seleccionada
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

  // S-093 (CA-4, TS-6, no-regresión): proyectos y tareas no cambian su fuente de datos
  it('S-093 TS-6 (no-regresión): proyectos y tareas se agrupan igual, sin tocar useProjects/usePersonObjectives', () => {
    render(<TargetSelector personId={1} value={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Alpha (A)')).toBeInTheDocument();
    expect(screen.getByText('O1 → Alpha')).toBeInTheDocument();
    const groupLabels = Array.from(destinoSelect().querySelectorAll('optgroup')).map((g) =>
      g.getAttribute('label')
    );
    expect(groupLabels).toEqual(['Proyectos', 'Requisitos', 'Tareas']);
  });

  // S-093 (CA-5, TS-7, edge case): usePersonRequirements vacío no rompe el selector
  it('S-093 TS-7: usePersonRequirements vacío no rompe el render, sin "Sin resultados" si hay otras fuentes', () => {
    mockedUsePersonRequirements.mockReturnValue(asQuery([]));

    render(<TargetSelector personId={1} value={null} onSelect={vi.fn()} />);

    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha (A)')).toBeInTheDocument();
    expect(screen.getByText('O1 → Alpha')).toBeInTheDocument();
  });
});
