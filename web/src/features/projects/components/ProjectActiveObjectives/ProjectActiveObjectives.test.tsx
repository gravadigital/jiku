import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useObjectives } from '@/features/objectives/hooks/useObjectives';
import { ProjectActiveObjectives } from './ProjectActiveObjectives';
import type { Objective } from '@/shared/types';

vi.mock('@/features/objectives/hooks/useObjectives', () => ({
  useObjectives: vi.fn(),
}));

vi.mock('@root/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: '1', name: 'Test User' }),
}));

vi.mock('@/features/objectives/components/ObjectiveCard', () => ({
  ObjectiveCard: ({ title }: { title: string }) => <div data-testid="objective-card">{title}</div>,
}));

vi.mock('@/shared/components/ui/Loader', () => ({
  Loader: ({ label }: { label: string }) => <div data-testid="loader">{label}</div>,
}));

vi.mock('../ObjectiveStateFilter', () => ({
  ObjectiveStateFilter: ({
    selectedStates,
    onChange,
  }: {
    selectedStates: string[];
    onChange: (s: string[]) => void;
  }) => (
    <div data-testid="state-filter" data-selected={selectedStates.join(',')}>
      <button onClick={() => onChange(['backlog', 'activo', 'en_revision'])}>Todos</button>
    </div>
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
};

const makeObjective = (overrides: Partial<Objective>): Objective =>
  ({
    id: 1,
    area: 'tech',
    title: 'Objetivo',
    state: 'activo',
    priority: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    estimatedFinishDate: null,
    finishedAt: null,
    projectId: 123,
    project: { id: 123, name: 'Proyecto' },
    persons: [],
    creator: { id: 1, name: 'Creator' },
    workedMinutes: 0,
    visibilityLevel: 'public',
    ...overrides,
  }) as unknown as Objective;

describe('ProjectActiveObjectives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra Loader mientras carga', () => {
    vi.mocked(useObjectives).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useObjectives>);

    render(<ProjectActiveObjectives projectId={123} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('con selectedStates=[activo] por defecto solo muestra objetivos activos', () => {
    vi.mocked(useObjectives).mockReturnValue({
      data: [
        makeObjective({ id: 1, title: 'Obj activo', state: 'activo' }),
        makeObjective({ id: 2, title: 'Obj backlog', state: 'backlog' }),
        makeObjective({ id: 3, title: 'Obj cancelado', state: 'cancelado' }),
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useObjectives>);

    render(<ProjectActiveObjectives projectId={123} />, { wrapper: createWrapper() });
    const cards = screen.getAllByTestId('objective-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Obj activo');
  });

  it('ordena por estimatedFinishDate ASC, nulls al final', () => {
    vi.mocked(useObjectives).mockReturnValue({
      data: [
        makeObjective({
          id: 1,
          title: 'Fecha lejana',
          state: 'activo',
          estimatedFinishDate: new Date('2026-04-01'),
        }),
        makeObjective({ id: 2, title: 'Sin fecha', state: 'activo', estimatedFinishDate: null }),
        makeObjective({
          id: 3,
          title: 'Fecha próxima',
          state: 'activo',
          estimatedFinishDate: new Date('2026-03-10'),
        }),
      ],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useObjectives>);

    render(<ProjectActiveObjectives projectId={123} />, { wrapper: createWrapper() });
    const cards = screen.getAllByTestId('objective-card');
    expect(cards[0]).toHaveTextContent('Fecha próxima');
    expect(cards[1]).toHaveTextContent('Fecha lejana');
    expect(cards[2]).toHaveTextContent('Sin fecha');
  });

  it('TS-23 (S-067): muestra "No hay tareas para los filtros seleccionados." cuando no hay resultados', () => {
    vi.mocked(useObjectives).mockReturnValue({
      data: [makeObjective({ id: 1, title: 'Solo backlog', state: 'backlog' })],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useObjectives>);

    render(<ProjectActiveObjectives projectId={123} />, { wrapper: createWrapper() });
    expect(screen.getByText('No hay tareas para los filtros seleccionados.')).toBeInTheDocument();
  });

  it('muestra mensaje de error cuando isError=true', () => {
    vi.mocked(useObjectives).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useObjectives>);

    render(<ProjectActiveObjectives projectId={123} />, { wrapper: createWrapper() });
    expect(screen.getByText(/error al cargar/i)).toBeInTheDocument();
  });
});
