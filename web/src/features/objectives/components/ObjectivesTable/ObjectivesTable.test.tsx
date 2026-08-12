import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as objectivesApi from '../../services/objectivesApi';
import { ObjectivesTable } from './ObjectivesTable';
import type { ObjectiveFilters } from '@/features/objectives';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../../services/objectivesApi');

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const baseFilters: ObjectiveFilters = {
  area: null,
  limit: 20,
  page: 1,
  personId: null,
  projectId: null,
  projectName: null,
  search: null,
  sort: '-createdAt',
  state: 'activo',
};

beforeEach(() => vi.clearAllMocks());

describe('ObjectivesTable', () => {
  it('TS-2 (S-067): el header de columna dice "Tarea" en vez de "Objetivo"', async () => {
    vi.mocked(objectivesApi.getObjectivesCount).mockResolvedValue(1);
    vi.mocked(objectivesApi.getObjectives).mockResolvedValue([
      {
        id: 1,
        area: 'desarrollo',
        createdAt: new Date('2026-01-01'),
        estimatedFinishDate: null,
        finishedAt: null,
        persons: [],
        priority: 0,
        project: { id: 1, name: 'Proyecto Alpha' },
        state: 'activo',
        title: 'Tarea de prueba',
      },
    ] as any);

    render(await ObjectivesTable({ filters: baseFilters }), { wrapper: createWrapper() });

    expect(screen.getByText('Tarea')).toBeInTheDocument();
    expect(screen.queryByText('Objetivo')).not.toBeInTheDocument();
  });

  it('TS-3 (S-067): muestra "No hay tareas que coincidan con estos filtros." cuando no hay resultados', async () => {
    vi.mocked(objectivesApi.getObjectivesCount).mockResolvedValue(0);
    vi.mocked(objectivesApi.getObjectives).mockResolvedValue([]);

    render(await ObjectivesTable({ filters: baseFilters }), { wrapper: createWrapper() });

    expect(screen.getByText('No hay tareas que coincidan con estos filtros.')).toBeInTheDocument();
  });
});
