import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { useReportByPerson } from '../../hooks/useReportByPerson';
import { useReportByProject } from '../../hooks/useReportByProject';
import { useUnworkedTimesReasons } from '../../hooks/useUnworkedTimesReasons';
import { useUnworkedTimesReportByPersons } from '../../hooks/useUnworkedTimesReportByPersons';
import { ReportPage } from './ReportPage';

vi.mock('../../hooks/useReportByPerson', () => ({
  useReportByPerson: vi.fn(),
}));
vi.mock('../../hooks/useReportByProject', () => ({
  useReportByProject: vi.fn(),
}));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: vi.fn(),
}));
vi.mock('../../hooks/useUnworkedTimesReasons', () => ({
  useUnworkedTimesReasons: vi.fn(),
}));
vi.mock('../../hooks/useUnworkedTimesReportByPersons', () => ({
  useUnworkedTimesReportByPersons: vi.fn(),
}));
vi.mock('../PeriodFilter', () => ({
  PeriodFilter: ({ onPeriodChange }: { onPeriodChange: (from: string, to: string) => void }) => (
    <button
      type="button"
      data-testid="period-custom"
      onClick={() => onPeriodChange('2026-06-01', '2026-06-30')}
    >
      period-custom
    </button>
  ),
}));

const mockedUseReportByPerson = vi.mocked(useReportByPerson);
const mockedUseReportByProject = vi.mocked(useReportByProject);
const mockedUseProjects = vi.mocked(useProjects);
const mockedUseUnworkedTimesReasons = vi.mocked(useUnworkedTimesReasons);
const mockedUseUnworkedTimesReportByPersons = vi.mocked(useUnworkedTimesReportByPersons);

function mockQuery(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data, isLoading: false, isError: false } as any;
}

async function selectProjectType(user: ReturnType<typeof userEvent.setup>, label: string) {
  const trigger = screen.getByRole('button', { name: /Tipo de proyecto/ });
  await user.click(trigger);
  await user.click(screen.getByRole('checkbox', { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseUnworkedTimesReasons.mockReturnValue(mockQuery([]));
  mockedUseUnworkedTimesReportByPersons.mockReturnValue(new Map());
});

describe('ReportPage — S-071 (filtro por tipo de proyecto, dropdown de checkboxes)', () => {
  it('TS-16: sin tildes, muestra el reporte completo sin filtrar', () => {
    mockedUseReportByPerson.mockReturnValue(
      mockQuery([
        {
          personId: 1,
          personFirstName: 'Ivan',
          personLastName: 'Maldonado',
          totalMinutes: 170,
          projects: [
            {
              projectId: 1,
              projectName: 'Verifarma',
              projectCode: 'CL',
              totalMinutes: 170,
              objectives: [],
            },
          ],
        },
      ])
    );
    mockedUseReportByProject.mockReturnValue(mockQuery([]));
    mockedUseProjects.mockReturnValue(mockQuery([{ id: 1, type: 'comercial' }]));

    render(<ReportPage />);

    expect(screen.getAllByText('2h 50m').length).toBeGreaterThan(0);
    expect(screen.getByText('Ivan Maldonado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tipo de proyecto' })).toBeInTheDocument();
  });

  it('TS-17: tildar "Comercial" muestra solo proyectos type=comercial y recalcula cards', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(
      mockQuery([
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
      ])
    );
    mockedUseReportByProject.mockReturnValue(mockQuery([]));
    mockedUseProjects.mockReturnValue(
      mockQuery([
        { id: 1, type: 'comercial' },
        { id: 2, type: 'interno' },
      ])
    );

    render(<ReportPage />);
    await selectProjectType(user, 'Comercial');

    expect(screen.getAllByText('1h 40m').length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    await user.click(screen.getByText('Ivan Maldonado'));
    expect(screen.getByText('CL')).toBeInTheDocument();
    expect(screen.queryByText('INT')).not.toBeInTheDocument();
  });

  it('tildar "Interno" + "Investigación" + "Propuesta" muestra esos 3 proyectos en vista por-proyecto', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(mockQuery([]));
    mockedUseReportByProject.mockReturnValue(
      mockQuery([
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
          persons: [
            { personId: 2, personFirstName: 'Ana', personLastName: 'Gomez', totalMinutes: 30 },
          ],
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
      ])
    );
    mockedUseProjects.mockReturnValue(
      mockQuery([
        { id: 1, type: 'comercial' },
        { id: 2, type: 'interno' },
        { id: 3, type: 'investigacion' },
        { id: 4, type: 'propuesta' },
      ])
    );

    render(<ReportPage />);
    await user.click(screen.getByText('Por proyecto'));

    const trigger = screen.getByRole('button', { name: /Tipo de proyecto/ });
    await user.click(trigger);
    await user.click(screen.getByRole('checkbox', { name: 'Interno' }));
    await user.click(screen.getByRole('checkbox', { name: 'Investigación' }));
    await user.click(screen.getByRole('checkbox', { name: 'Propuesta' }));
    await user.keyboard('{Escape}');

    expect(screen.getByText('Interno Grava')).toBeInTheDocument();
    expect(screen.getByText('I+D Nuevas Tecnologias')).toBeInTheDocument();
    expect(screen.getByText('Propuesta Cliente X')).toBeInTheDocument();
    expect(screen.queryByText('Verifarma')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('filtro de tipo se combina con ViewToggle "Por proyecto" y PeriodFilter', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(mockQuery([]));
    mockedUseReportByProject.mockReturnValue(
      mockQuery([
        {
          projectId: 1,
          projectName: 'Verifarma',
          projectCode: 'CL',
          totalMinutes: 100,
          objectives: [],
          persons: [],
        },
      ])
    );
    mockedUseProjects.mockReturnValue(mockQuery([{ id: 1, type: 'comercial' }]));

    render(<ReportPage />);
    await selectProjectType(user, 'Comercial');
    await user.keyboard('{Escape}');
    await user.click(screen.getByText('Por proyecto'));
    await user.click(screen.getByTestId('period-custom'));

    expect(mockedUseReportByProject).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: '2026-06-01', dateTo: '2026-06-30', enabled: true })
    );
    expect(screen.getByText('Verifarma')).toBeInTheDocument();
  });

  it('combinación con vista "Por persona" excluye persona sin horas comerciales', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(
      mockQuery([
        {
          personId: 1,
          personFirstName: 'Ivan',
          personLastName: 'Maldonado',
          totalMinutes: 60,
          projects: [
            {
              projectId: 1,
              projectName: 'Verifarma',
              projectCode: 'CL',
              totalMinutes: 60,
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
      ])
    );
    mockedUseReportByProject.mockReturnValue(mockQuery([]));
    mockedUseProjects.mockReturnValue(
      mockQuery([
        { id: 1, type: 'comercial' },
        { id: 2, type: 'interno' },
      ])
    );

    render(<ReportPage />);
    await selectProjectType(user, 'Comercial');
    await user.keyboard('{Escape}');

    expect(screen.getByText('Ivan Maldonado')).toBeInTheDocument();
    expect(screen.queryByText('Ana Gomez')).not.toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1h').length).toBeGreaterThan(0);
  });

  it('TS-18: sin resultados para los tipos tildados muestra estado vacío', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(mockQuery([]));
    mockedUseReportByProject.mockReturnValue(
      mockQuery([
        {
          projectId: 1,
          projectName: 'Verifarma',
          projectCode: 'CL',
          totalMinutes: 100,
          objectives: [],
          persons: [],
        },
      ])
    );
    mockedUseProjects.mockReturnValue(mockQuery([{ id: 1, type: 'comercial' }]));

    render(<ReportPage />);
    await user.click(screen.getByText('Por proyecto'));
    await selectProjectType(user, 'Interno');
    await user.keyboard('{Escape}');

    expect(screen.getByText('No hay horas registradas para este período')).toBeInTheDocument();
    expect(screen.queryByText('Total horas')).not.toBeInTheDocument();
  });

  it('proyecto no resuelto en useProjects() se excluye al tildar un tipo pero se incluye sin tildes', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(
      mockQuery([
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
      ])
    );
    mockedUseReportByProject.mockReturnValue(mockQuery([]));
    mockedUseProjects.mockReturnValue(mockQuery([]));

    render(<ReportPage />);
    expect(screen.getByText('Ivan Maldonado')).toBeInTheDocument();

    await selectProjectType(user, 'Comercial');
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Ivan Maldonado')).not.toBeInTheDocument();
    expect(screen.getByText('No hay horas registradas para este período')).toBeInTheDocument();
  });

  it('ausencias (projectCode=AUS) se excluyen al tildar un tipo', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(
      mockQuery([
        {
          personId: 1,
          personFirstName: 'Ivan',
          personLastName: 'Maldonado',
          totalMinutes: 80,
          projects: [
            {
              projectId: 1,
              projectName: 'Verifarma',
              projectCode: 'CL',
              totalMinutes: 50,
              objectives: [],
            },
            {
              projectId: 0,
              projectName: 'Ausencias',
              projectCode: 'AUS',
              totalMinutes: 30,
              objectives: [],
            },
          ],
        },
      ])
    );
    mockedUseReportByProject.mockReturnValue(mockQuery([]));
    mockedUseProjects.mockReturnValue(mockQuery([{ id: 1, type: 'comercial' }]));

    render(<ReportPage />);
    await selectProjectType(user, 'Comercial');
    await user.keyboard('{Escape}');

    expect(screen.getAllByText('0h 50m').length).toBeGreaterThan(0);
  });

  it('destildar el único tipo seleccionado vuelve al comportamiento "Todos" sin nuevas llamadas a la API', async () => {
    const user = userEvent.setup();
    mockedUseReportByPerson.mockReturnValue(
      mockQuery([
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
      ])
    );
    mockedUseReportByProject.mockReturnValue(mockQuery([]));
    mockedUseProjects.mockReturnValue(
      mockQuery([
        { id: 1, type: 'comercial' },
        { id: 2, type: 'interno' },
      ])
    );

    render(<ReportPage />);

    await selectProjectType(user, 'Comercial');
    await user.click(screen.getByRole('checkbox', { name: 'Comercial' }));
    await user.keyboard('{Escape}');

    expect(screen.getAllByText('2h 30m').length).toBeGreaterThan(0);

    const distinctArgs = new Set(
      mockedUseReportByPerson.mock.calls.map((call) => JSON.stringify(call[0]))
    );
    expect(distinctArgs.size).toBe(1);
    const distinctProjectsArgs = new Set(
      mockedUseProjects.mock.calls.map((call) => JSON.stringify(call[0]))
    );
    expect(distinctProjectsArgs.size).toBe(1);
  });

  it('TS-19: el botón del filtro de tipo es hijo de styles.toggleGroup, hermano de ViewToggle', () => {
    mockedUseReportByPerson.mockReturnValue(mockQuery([]));
    mockedUseReportByProject.mockReturnValue(mockQuery([]));
    mockedUseProjects.mockReturnValue(mockQuery([]));

    render(<ReportPage />);

    const filterButton = screen.getByRole('button', { name: 'Tipo de proyecto' });
    const filterContainer = filterButton.parentElement;
    const viewToggleContainer = screen.getByText('Por persona').parentElement;
    expect(filterContainer?.parentElement).toBe(viewToggleContainer?.parentElement);
  });
});
