import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHoursPerDay } from '../../hooks/useHoursPerDay';
import { useSaveAllocations } from '../../hooks/useSaveAllocations';
import { useWeekAllocations } from '../../hooks/useWeekAllocations';
import { WeeklyAllocationTable } from './WeeklyAllocationTable';

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));
vi.mock('../../hooks/useWeekAllocations', () => ({ useWeekAllocations: vi.fn() }));
vi.mock('../../hooks/useHoursPerDay', () => ({ useHoursPerDay: vi.fn() }));
vi.mock('../../hooks/useSaveAllocations', () => ({ useSaveAllocations: vi.fn() }));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: vi.fn(() => ({ data: [] })),
}));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedUseSession = vi.mocked(useSession);
const mockedUseWeekAllocations = vi.mocked(useWeekAllocations);
const mockedUseHoursPerDay = vi.mocked(useHoursPerDay);
const mockedUseSaveAllocations = vi.mocked(useSaveAllocations);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

 
const asQuery = (data: unknown, overrides: Record<string, unknown> = {}) =>
  ({ data, isLoading: false, isError: false, ...overrides }) as any;

const PERSONS = [
  { id: 1, firstName: 'Ana', lastName: 'Gomez' },
  { id: 2, firstName: 'Beto', lastName: 'Diaz' },
];

const PROJECTS = [
  { id: 10, name: 'Proyecto X', code: 'PX' },
  { id: 11, name: 'Proyecto Y', code: 'PY' },
];

const ALLOCATIONS = [
  { id: 1, personId: 1, projectId: 10, minutes: 600, internal: false, dateFrom: '', dateTo: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseSession.mockReturnValue({ data: { user: { roles: [] } } } as any);
  mockedUseHoursPerDay.mockReturnValue(asQuery({ hoursPerDay: 6 }));
  mockedUseSaveAllocations.mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
});

describe('WeeklyAllocationTable — migración a Table variant matrix (S-058)', () => {
  it('TS-91: es un <table> real; cada persona es th scope="col" y cada proyecto th scope="row"', () => {
    mockedUseWeekAllocations.mockReturnValue(
      asQuery({
        weekStart: '2026-09-07',
        weekEnd: '2026-09-11',
        allocations: ALLOCATIONS,
        persons: PERSONS,
        projects: PROJECTS,
      })
    );

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const personHeaders = within(table).getAllByRole('columnheader');
    expect(personHeaders.map((h) => h.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Ana'), expect.stringContaining('Beto')])
    );

    const rowHeaders = within(table).getAllByRole('rowheader');
    expect(rowHeaders.some((h) => h.textContent?.includes('Proyecto X'))).toBe(true);
    expect(rowHeaders.some((h) => h.textContent?.includes('Proyecto Y'))).toBe(true);
  });

  it('TS-93: sin proyectos, muestra EmptyState variant list con el microcopy exacto, sin role="alert"', () => {
    mockedUseWeekAllocations.mockReturnValue(
      asQuery({
        weekStart: '2026-09-07',
        weekEnd: '2026-09-11',
        allocations: [],
        persons: [],
        projects: [],
      })
    );

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    expect(
      screen.getByText('No hay proyectos con asignaciones para esta semana.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el mensaje de error de sistema no comparte marcado con el EmptyState (mensaje-error, gap aceptado)', () => {
    mockedUseWeekAllocations.mockReturnValue(
      asQuery(undefined, { isError: true, data: undefined })
    );

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    expect(
      screen.getByText('No se pudieron cargar las asignaciones. Intentá de nuevo más tarde.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No hay proyectos con asignaciones para esta semana.')
    ).not.toBeInTheDocument();
  });

  it('TS-94: usa WeekNav — nav con nombre accesible "Navegación de semana"', () => {
    mockedUseWeekAllocations.mockReturnValue(
      asQuery({
        weekStart: '2026-09-07',
        weekEnd: '2026-09-11',
        allocations: [],
        persons: [],
        projects: [],
      })
    );

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    expect(screen.getByRole('navigation', { name: 'Navegación de semana' })).toBeInTheDocument();
  });

  // TS-94 (escenario exacto del Story Plan): 2026-09-28 (lunes) resuelve el cruce a octubre
  // al avanzar una semana, y "Esta semana" queda visible y marcada cuando corresponde.
  it('TS-94: WeekNav resuelve el cruce de mes (28 sep – 4 oct) y "Esta semana" nunca se oculta', () => {
    vi.useFakeTimers();
    // La semana actual (lunes 2026-09-28 a viernes 2026-10-02) cruza septiembre → octubre.
    vi.setSystemTime(new Date('2026-09-28T00:00:00Z'));

    mockedUseWeekAllocations.mockReturnValue(
      asQuery({
        weekStart: '2026-09-28',
        weekEnd: '2026-10-02',
        allocations: [],
        persons: [],
        projects: [],
      })
    );

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    // El rango se lee con ambos meses (aparece dos veces: texto visible + región viva).
    expect(
      screen.getAllByText(/septiembre.*octubre|octubre.*septiembre/i).length
    ).toBeGreaterThan(0);

    // "Esta semana" está visible (nunca oculta) y, al ser ya la semana actual, deshabilitada.
    const todayButton = screen.getByRole('button', { name: 'Esta semana' });
    expect(todayButton).toBeInTheDocument();
    expect(todayButton).toBeDisabled();

    // Retroceder una semana: "Esta semana" pasa a habilitada — nunca se oculta, sólo cambia
    // de estado. Vuelve a ser la semana actual sin necesidad de tocar el reloj del sistema.
    fireEvent.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(screen.getByRole('button', { name: 'Esta semana' })).not.toBeDisabled();

    vi.useRealTimers();
  });

  it('TS-95: rol admin (isEditable) muestra celdas editables con nombre accesible persona+proyecto', () => {
    mockedUseSession.mockReturnValue({ data: { user: { roles: ['admin'] } } } as any);
    mockedUseWeekAllocations.mockReturnValue(
      asQuery({
        weekStart: '2026-09-07',
        weekEnd: '2026-09-11',
        allocations: ALLOCATIONS,
        persons: PERSONS,
        projects: PROJECTS,
      })
    );

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    const editableField = screen.getByRole('textbox', {
      name: /Ana.*Proyecto X|Proyecto X.*Ana/i,
    });
    expect(editableField).toBeInTheDocument();
  });

  it('TS-95: rol user (sólo lectura) no muestra campos editables', () => {
    mockedUseSession.mockReturnValue({ data: { user: { roles: ['user'] } } } as any);
    mockedUseWeekAllocations.mockReturnValue(
      asQuery({
        weekStart: '2026-09-07',
        weekEnd: '2026-09-11',
        allocations: ALLOCATIONS,
        persons: PERSONS,
        projects: PROJECTS,
      })
    );

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('TS-96: el botón de guardar es Button primary con loading durante la mutación', () => {
    mockedUseSession.mockReturnValue({ data: { user: { roles: ['admin'] } } } as any);
    mockedUseWeekAllocations.mockReturnValue(
      asQuery({
        weekStart: '2026-09-07',
        weekEnd: '2026-09-11',
        allocations: ALLOCATIONS,
        persons: PERSONS,
        projects: PROJECTS,
      })
    );
    mockedUseSaveAllocations.mockReturnValue({ mutate: vi.fn(), isPending: true } as any);

    render(<WeeklyAllocationTable />, { wrapper: createWrapper() });

    // Button en loading reemplaza su label por el Loader del DS (comportamiento normativo
    // de Button, S-053): el nombre accesible pasa a "Cargando" y aria-busy="true".
    const saveButton = screen.getByRole('status', { name: 'Cargando' }).closest('button');
    expect(saveButton).toHaveAttribute('aria-busy', 'true');
  });

  it('TS-98: no importa axios, apiClient ni llama a fetch directamente', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, './WeeklyAllocationTable.tsx'),
      'utf8'
    );
    expect(content).not.toMatch(/from ['"]axios['"]/);
    expect(content).not.toMatch(/apiClient/);
    expect(content).not.toMatch(/\bfetch\(/);
  });

  it('no quedan <table> ad-hoc: usa el Table del DS (import desde @/shared/components/ui)', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, './WeeklyAllocationTable.tsx'),
      'utf8'
    );
    expect(content).not.toMatch(/<table/);
  });
});
