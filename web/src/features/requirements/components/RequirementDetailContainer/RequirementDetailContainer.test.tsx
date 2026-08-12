import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useObjectivesModule from '@/features/objectives/hooks/useObjectives';
import { getRequirementById } from '../../services/requirementsApi';
import { RequirementDetailContainer } from './RequirementDetailContainer';
import type { RequirementDetail } from '../../types/requirement.types';

vi.mock('../RequirementDetail', () => ({
  RequirementDetail: ({ requirement }: { requirement: RequirementDetail }) => (
    <div data-testid="requirement-detail">{requirement.title}</div>
  ),
}));

vi.mock('../../services/requirementsApi', () => ({
  getRequirementById: vi.fn(),
}));

vi.mock('@/features/objectives/hooks/useObjectives', () => ({
  useObjectives: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

const baseRequirement: RequirementDetail = {
  id: 5,
  title: 'Requisito inicial',
  description: '',
  type: 'funcionalidad',
  priority: 'alta',
  state: 'analisis',
  visibilityLevel: 'public',
  estimatedFinishDate: null,
  projectId: 1,
  project: { id: 1, name: 'PRJ-1' },
  responsiblePeople: [],
  createdBy: 'ivan@grava.io',
  creator: { id: 'u1', name: 'Iván López', email: 'ivan@grava.io' },
  tags: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  activity: [],
  resolutionConclusion: null,
  scope: null,
  technicalSolution: null,
  acceptanceCriteria: null,
  linkedObjectives: [],
};

describe('RequirementDetailContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequirementById).mockResolvedValue(baseRequirement);
  });

  it('renderiza RequirementDetail con el requirement inicial provisto por el servidor', () => {
    const { Wrapper } = createWrapper();
    render(<RequirementDetailContainer reqid={5} initialRequirement={baseRequirement} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('requirement-detail')).toHaveTextContent('Requisito inicial');
  });

  it('refleja el requirement actualizado cuando la caché de React Query se invalida y refetchea', async () => {
    const { Wrapper, queryClient } = createWrapper();
    render(<RequirementDetailContainer reqid={5} initialRequirement={baseRequirement} />, {
      wrapper: Wrapper,
    });

    expect(screen.getByTestId('requirement-detail')).toHaveTextContent('Requisito inicial');

    queryClient.setQueryData(['requirement', 5], {
      ...baseRequirement,
      title: 'Requisito actualizado',
    });

    expect(await screen.findByText('Requisito actualizado')).toBeInTheDocument();
  });

  // TS-8/AC-6: ya no se realiza fetch aparte de objetivos, se usa linkedObjectives embebido
  it('no invoca useObjectives (el fetch redundante fue eliminado, se usa linkedObjectives del requirement)', () => {
    const { Wrapper } = createWrapper();
    render(<RequirementDetailContainer reqid={5} initialRequirement={baseRequirement} />, {
      wrapper: Wrapper,
    });

    expect(useObjectivesModule.useObjectives).not.toHaveBeenCalled();
  });
});
