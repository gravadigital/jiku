import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useRequirementModule from '@/features/requirements/hooks/useRequirement';
import { ObjectiveDetails } from './ObjectiveDetails';
import type { Objective } from '@/shared/types';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/features/requirements/hooks/useRequirement', () => ({
  useRequirement: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const baseObjective: Objective = {
  id: 12,
  area: 'desarrollo',
  title: 'Objetivo de prueba',
  description: 'Descripción',
  estimatedFinishDate: null,
  finishedAt: null,
  state: 'activo',
  priority: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  projectId: 5,
  project: { id: 5, name: 'Proyecto X' } as any,
  persons: [],
  creator: { id: 'u1', name: 'Ana Pérez', email: 'ana@grava.io' } as any,
  workedMinutes: 0,
  visibilityLevel: 'public',
  requirementId: null,
};

describe('ObjectiveDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-2: sin requirementId no muestra ninguna fila "Requisito"', () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={baseObjective} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Requisito')).not.toBeInTheDocument();
  });

  it('TS-1: con requirementId muestra el título del requisito como link', async () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: { id: 42, title: 'REQ-12 Bug login' },
      isError: false,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={{ ...baseObjective, requirementId: 42 }} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const link = screen.getByRole('link', { name: 'REQ-12 Bug login' });
      expect(link).toHaveAttribute('href', '/requirements/42');
    });
  });

  it('TS-3: si useRequirement falla, muestra "Requisito no disponible"', async () => {
    vi.mocked(useRequirementModule.useRequirement).mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
    } as any);

    render(<ObjectiveDetails objective={{ ...baseObjective, requirementId: 99 }} />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText(/Requisito no disponible/)).toBeInTheDocument();
  });
});
