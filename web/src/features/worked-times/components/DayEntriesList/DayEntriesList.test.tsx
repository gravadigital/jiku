import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRequirements } from '@/features/requirements/hooks/useRequirements';
import { usePersonObjectives } from '../../hooks/usePersonObjectives';
import { getUnworkedTimes } from '../../services/unworkedTimesApi';
import { getWorkedTimes } from '../../services/workedTimesApi';
import { DayEntriesList } from './DayEntriesList';
import type { WorkedTimeEntry } from '../../types/worked-time.types';

// DayEntriesList importa ConfirmDialog/SectionCard desde el barrel @/shared/components/ui,
// que arrastra módulos server de next-auth. Se stubean para aislar el componente.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));

vi.mock('../../services/workedTimesApi', () => ({
  getWorkedTimes: vi.fn(),
}));

vi.mock('../../services/unworkedTimesApi', () => ({
  getUnworkedTimes: vi.fn(),
}));

vi.mock('../../hooks/useDeleteWorkedTime', () => ({
  useDeleteWorkedTime: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../../hooks/useDeleteUnworkedTime', () => ({
  useDeleteUnworkedTime: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('../../hooks/usePersonObjectives', () => ({
  usePersonObjectives: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/features/requirements/hooks/useRequirements', () => ({
  useRequirements: vi.fn(() => ({ data: [] })),
}));

const mockedGetWorkedTimes = vi.mocked(getWorkedTimes);
const mockedGetUnworkedTimes = vi.mocked(getUnworkedTimes);
const mockedUsePersonObjectives = vi.mocked(usePersonObjectives);
const mockedUseRequirements = vi.mocked(useRequirements);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const baseEntry: Omit<WorkedTimeEntry, 'objective' | 'requirement'> = {
  id: 1,
  date: '2026-06-26',
  minutes: 120,
  projectId: 1,
  project: { id: 1, name: 'Alpha', code: 'A' },
  objectiveId: null,
  requirementId: null,
  personId: 1,
  createdAt: '2026-06-26T00:00:00Z',
};

describe('DayEntriesList — S-055', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetWorkedTimes.mockResolvedValue([]);
    mockedGetUnworkedTimes.mockResolvedValue([]);
    mockedUsePersonObjectives.mockReturnValue({ data: [] } as any);
    mockedUseRequirements.mockReturnValue({ data: [] } as any);
  });

  // TS-12: Listado muestra requisito como destino (orden Proyecto → Requisito) + ícono de requisito
  it('TS-12: muestra "Presente → Alpha → R" con ícono de requisito cuando la carga tiene requisito', async () => {
    mockedGetWorkedTimes.mockResolvedValue([
      {
        ...baseEntry,
        requirementId: 5,
        requirement: { id: 5, title: 'R' },
        objective: null,
      },
    ]);

    render(<DayEntriesList date="2026-06-26" personId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Presente → Alpha → R')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Requisito' })).toBeInTheDocument();
  });

  // TS-13: Listado mantiene caso objetivo sin requisito (orden Proyecto → Objetivo) + ícono de tarea
  it('TS-13: muestra "Presente → Alpha → Obj X" con ícono de tarea cuando la carga tiene objetivo sin requisito', async () => {
    mockedGetWorkedTimes.mockResolvedValue([
      {
        ...baseEntry,
        objectiveId: 10,
        objective: { id: 10, title: 'Obj X' },
        requirement: null,
      },
    ]);
    mockedUsePersonObjectives.mockReturnValue({
      data: [{ id: 10, title: 'Obj X', projectId: 1, projectName: 'Alpha', requirementId: null }],
    } as any);

    render(<DayEntriesList date="2026-06-26" personId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Presente → Alpha → Obj X')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tarea' })).toBeInTheDocument();
  });

  // TS-14: Listado mantiene caso solo-proyecto (sin regresión) + ícono de proyecto
  it('TS-14: muestra "Presente → Alpha" con ícono de proyecto cuando la carga es solo proyecto', async () => {
    mockedGetWorkedTimes.mockResolvedValue([
      {
        ...baseEntry,
        objective: null,
        requirement: null,
      },
    ]);

    render(<DayEntriesList date="2026-06-26" personId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Presente → Alpha')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Proyecto' })).toBeInTheDocument();
  });

  // Nuevo: objetivo que pertenece a un requisito muestra los 4 pasos completos, ícono de tarea (destino más específico)
  it('muestra "Presente → Alpha → R → Obj X" con ícono de tarea cuando el objetivo pertenece a un requisito', async () => {
    mockedGetWorkedTimes.mockResolvedValue([
      {
        ...baseEntry,
        objectiveId: 10,
        objective: { id: 10, title: 'Obj X' },
        requirement: null,
      },
    ]);
    mockedUsePersonObjectives.mockReturnValue({
      data: [{ id: 10, title: 'Obj X', projectId: 1, projectName: 'Alpha', requirementId: 5 }],
    } as any);
    mockedUseRequirements.mockReturnValue({
      data: [{ id: 5, title: 'R', projectId: 1 }],
    } as any);

    render(<DayEntriesList date="2026-06-26" personId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Presente → Alpha → R → Obj X')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tarea' })).toBeInTheDocument();
  });

  // TS-85: el día vacío muestra EmptyState variant scoped con su microcopy exacto
  it('TS-85: día vacío muestra "No hay cargas para este día" sin role="alert"', async () => {
    render(<DayEntriesList date="2026-06-26" personId={1} />, { wrapper: createWrapper() });

    const empty = await screen.findByText('No hay cargas para este día');
    expect(empty).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // TS-96 (parte de DayEntriesList): el borrado usa el Button del DS variant secondary-dismiss
  it('TS-96: el botón de borrar una carga usa el Button del DS y abre el ConfirmDialog', async () => {
    mockedGetWorkedTimes.mockResolvedValue([
      {
        ...baseEntry,
        objective: null,
        requirement: null,
      },
    ]);

    render(<DayEntriesList date="2026-06-26" personId={1} />, { wrapper: createWrapper() });

    const deleteButton = await screen.findByRole('button', { name: 'Borrar' });
    expect(deleteButton).toBeInTheDocument();

    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(deleteButton);

    expect(screen.getByRole('dialog', { name: 'Eliminar registro' })).toBeInTheDocument();
  });

  it('no quedan <button> crudos: usa Loader del DS mientras carga', () => {
    mockedGetWorkedTimes.mockImplementation(() => new Promise(() => {}));
    render(<DayEntriesList date="2026-06-26" personId={1} />, { wrapper: createWrapper() });

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
