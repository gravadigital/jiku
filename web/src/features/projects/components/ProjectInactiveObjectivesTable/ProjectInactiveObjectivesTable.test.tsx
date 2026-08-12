import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as objectivesApi from '@/features/objectives/services/objectivesApi';
import { ProjectInactiveObjectivesTable } from './ProjectInactiveObjectivesTable';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/objectives/services/objectivesApi');

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => vi.clearAllMocks());

describe('ProjectInactiveObjectivesTable', () => {
  it('TS-24 (S-067): sin datos muestra "No hay tareas inactivas."', async () => {
    vi.mocked(objectivesApi.getObjectives).mockResolvedValue([]);
    vi.mocked(objectivesApi.getObjectivesCount).mockResolvedValue(0);

    render(<ProjectInactiveObjectivesTable projectId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('No hay tareas inactivas.')).toBeInTheDocument();
  });

  it('TS-24 (S-067): con datos muestra header de columna "Tarea"', async () => {
    vi.mocked(objectivesApi.getObjectives).mockImplementation(async (filters: any) =>
      filters.state === 'finalizado'
        ? ([
            {
              id: 1,
              area: 'desarrollo',
              createdAt: new Date('2026-01-01'),
              estimatedFinishDate: null,
              finishedAt: new Date('2026-01-10'),
              persons: [],
              priority: 0,
              project: { id: 1, name: 'Proyecto Alpha' },
              state: 'finalizado',
              title: 'Tarea inactiva',
            },
          ] as any)
        : []
    );
    vi.mocked(objectivesApi.getObjectivesCount).mockImplementation(async (filters: any) =>
      filters.state === 'finalizado' ? 1 : 0
    );

    render(<ProjectInactiveObjectivesTable projectId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Tarea')).toBeInTheDocument();
  });

  it('TS-24 (S-067): mientras carga muestra "Cargando tareas inactivas..."', () => {
    vi.mocked(objectivesApi.getObjectives).mockReturnValue(new Promise(() => {}));
    vi.mocked(objectivesApi.getObjectivesCount).mockReturnValue(new Promise(() => {}));

    render(<ProjectInactiveObjectivesTable projectId={1} />, { wrapper: createWrapper() });

    expect(screen.getByText('Cargando tareas inactivas...')).toBeInTheDocument();
  });

  it('TS-24 (S-067): error en la query muestra "Error al cargar las tareas inactivas."', async () => {
    vi.mocked(objectivesApi.getObjectives).mockRejectedValue(new Error('fail'));
    vi.mocked(objectivesApi.getObjectivesCount).mockRejectedValue(new Error('fail'));

    render(<ProjectInactiveObjectivesTable projectId={1} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Error al cargar las tareas inactivas.')).toBeInTheDocument();
  });
});
