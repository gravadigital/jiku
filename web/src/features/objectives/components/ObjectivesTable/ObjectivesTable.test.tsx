import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as objectivesApi from '../../services/objectivesApi';
import { ObjectivesTable } from './ObjectivesTable';
import type { ObjectiveFilters } from '@/features/objectives';

const pushSpy = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
  useSearchParams: () => currentSearchParams,
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

beforeEach(() => {
  vi.clearAllMocks();
  currentSearchParams = new URLSearchParams();
});

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

  it('TS-24 (S-037): sigue montando el paginador y navegando a /objectives, con como máximo 10 números', async () => {
    currentSearchParams = new URLSearchParams('page=15');
    vi.mocked(objectivesApi.getObjectivesCount).mockResolvedValue(600);
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

    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(nav).toBeInTheDocument();
    const numberButtons = screen.getAllByRole('button', { name: /^Página \d+$/ });
    expect(numberButtons.length).toBeLessThanOrEqual(10);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Página 17' }));

    expect(pushSpy).toHaveBeenCalledTimes(1);
    const calledWith = pushSpy.mock.calls[0][0] as string;
    expect(calledWith.startsWith('/objectives?')).toBe(true);
    const params = new URLSearchParams(calledWith.split('?')[1]);
    expect(params.get('page')).toBe('17');
  });

  it('S-056 TS-10: usa Table variant dense, con table real y sin fila teñida por estado', async () => {
    vi.mocked(objectivesApi.getObjectivesCount).mockResolvedValue(1);
    vi.mocked(objectivesApi.getObjectives).mockResolvedValue([
      {
        id: 3,
        area: 'desarrollo',
        createdAt: new Date('2026-01-01'),
        description: null,
        estimatedFinishDate: new Date('2026-09-25'),
        finishedAt: null,
        persons: [],
        priority: 1,
        project: { id: 1, name: 'Proyecto Alpha' },
        state: 'activo',
        title: 'Migrar formulario',
      },
    ] as any);

    render(await ObjectivesTable({ filters: baseFilters }), { wrapper: createWrapper() });

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(7);
    headers.forEach((header) => expect(header).toHaveAttribute('scope', 'col'));
    // El link a la tarea es el destino accesible de la fila, ninguna <tr> lleva tinte de estado.
    expect(screen.getByRole('link', { name: 'Migrar formulario' })).toHaveAttribute(
      'href',
      '/objectives/3'
    );
  });

  it('S-056 TS-4 (variante tareas): el vacío usa EmptyState variant filtered, sin role alert', async () => {
    vi.mocked(objectivesApi.getObjectivesCount).mockResolvedValue(0);
    vi.mocked(objectivesApi.getObjectives).mockResolvedValue([]);

    render(await ObjectivesTable({ filters: baseFilters }), { wrapper: createWrapper() });

    const empty = screen.getByText('No hay tareas que coincidan con estos filtros.');
    expect(empty.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
