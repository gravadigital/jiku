import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useRequirementWorkedHoursModule from '../../hooks/useRequirementWorkedHours';
import * as useUpdateRequirementModule from '../../hooks/useUpdateRequirement';
import { RequirementDetail } from './RequirementDetail';
import type { Requirement } from '../../types/requirement.types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../../services/requirementsApi', () => ({
  updateRequirement: vi.fn(),
}));

vi.mock('../../hooks/useUpdateRequirement');

vi.mock('../RequirementActivityFeed', () => ({
  RequirementActivityFeed: () => <div data-testid="activity-feed" />,
}));

vi.mock('../RequirementActivityForm', () => ({
  RequirementActivityForm: () => <div data-testid="activity-form" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Sin mock de MarkdownViewer/AttachmentPlaceholder: verifica el renderizado real
// de markdown (negrita, listas, links) integrado en RequirementDetail (AC-3).
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// La card de horas se carga sola, con su propia query (S-045): se mockea el hook para que
// este archivo -que verifica markdown, no horas- no dependa de una request real.
vi.mock('../../hooks/useRequirementWorkedHours');

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const baseRequirement: Requirement = {
  id: 5,
  title: 'Req test',
  description: '',
  type: 'funcionalidad',
  priority: 'alta',
  state: 'analisis',
  visibilityLevel: 'public',
  estimatedFinishDate: '2026-06-30',
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
};

describe('RequirementDetail — AC-3 renderizado real de markdown en Contexto', () => {
  beforeEach(() => {
    vi.mocked(useUpdateRequirementModule.useUpdateRequirement).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(useRequirementWorkedHoursModule.useRequirementWorkedHours).mockReturnValue({
      data: { requirementId: 5, totalMinutes: 0, byPerson: [] },
      isLoading: false,
      isError: false,
    } as any);
  });

  it('AC-3: negrita en description se renderiza como <strong>', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, description: '**Urgente**' }} />, {
      wrapper: createWrapper(),
    });

    const strong = document.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('Urgente');
  });

  it('AC-3: lista markdown en description se renderiza como <ul>/<li>', () => {
    render(
      <RequirementDetail requirement={{ ...baseRequirement, description: '- item 1\n- item 2' }} />,
      { wrapper: createWrapper() }
    );

    const list = document.querySelector('ul');
    expect(list).toBeInTheDocument();
    expect(screen.getByText('item 1')).toBeInTheDocument();
    expect(screen.getByText('item 2')).toBeInTheDocument();
  });

  it('AC-3: link markdown en description se renderiza como <a href>', () => {
    render(
      <RequirementDetail
        requirement={{ ...baseRequirement, description: '[link](https://grava.io)' }}
      />,
      { wrapper: createWrapper() }
    );

    const link = screen.getByRole('link', { name: 'link' });
    expect(link).toHaveAttribute('href', 'https://grava.io');
  });
});
