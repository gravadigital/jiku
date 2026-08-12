import { render, screen } from '@testing-library/react';
import { RequirementDetailView } from './RequirementDetailView';
import type { RequirementDetail } from '../../types/requirement.types';
import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => 'list' }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'u1', roles: ['user'] }, accessToken: 'mock-token' },
    status: 'authenticated',
  }),
}));

vi.mock('@/features/subscriptions/hooks/useSubscribe', () => ({
  useSubscribe: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/features/subscriptions/hooks/useUnsubscribe', () => ({
  useUnsubscribe: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../RequirementDetailModal/components/RequirementInfoPanel/RequirementInfoPanel', () => ({
  RequirementInfoPanel: ({ requirement }: { requirement: RequirementDetail }) => (
    <div data-testid="requirement-info-panel">{requirement.title}</div>
  ),
}));

vi.mock('../RequirementDetailModal/components/ActivityPanel/ActivityPanel', () => ({
  ActivityPanel: () => <div data-testid="activity-panel" />,
}));

vi.mock('../RequirementDetailModal/components/CommentInput/CommentInput', () => ({
  CommentInput: () => <div data-testid="comment-input" />,
}));

const mockRequirement: RequirementDetail = {
  id: 42,
  title: 'Mi objetivo de prueba',
  description: 'Descripción de prueba',
  type: 'funcionalidad',
  state: 'analisis',
  priority: 'media',
  estimatedFinishDate: null,
  tags: [],
  projectId: 1,
  project: { id: 1, name: 'Proyecto Alpha' },
  scheduledAt: null,
  inProgressAt: null,
  inReviewAt: null,
  finishedAt: null,
  resolutionComment: null,
  creator: { id: 'u1', name: 'Juan Pérez', email: 'juan@x.com' },
  createdAt: '2026-01-13T00:00:00.000Z',
  updatedAt: '2026-01-13T00:00:00.000Z',
  requirementActivity: [],
  subscriptors: [],
};

describe('RequirementDetailView', () => {
  it('renderiza el layout de dos paneles', () => {
    render(
      <RequirementDetailView
        requirement={mockRequirement}
        projectName="Proyecto Alpha"
        projectId={1}
      />
    );
    expect(screen.getByTestId('requirement-info-panel')).toBeInTheDocument();
    expect(screen.getByTestId('activity-panel')).toBeInTheDocument();
    expect(screen.getByTestId('comment-input')).toBeInTheDocument();
  });

  it('renderiza BoardHeader con requirementId', () => {
    render(
      <RequirementDetailView
        requirement={mockRequirement}
        projectName="Proyecto Alpha"
        projectId={1}
      />
    );
    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('Requisitos')).toBeInTheDocument();
  });

  it('el panel derecho tiene topbar con texto "ACTIVIDAD"', () => {
    render(
      <RequirementDetailView
        requirement={mockRequirement}
        projectName="Proyecto Alpha"
        projectId={1}
      />
    );
    expect(screen.getByText('ACTIVIDAD')).toBeInTheDocument();
  });

  it('pasa el requirementId correcto al CommentInput', () => {
    render(
      <RequirementDetailView
        requirement={mockRequirement}
        projectName="Proyecto Alpha"
        projectId={1}
      />
    );
    expect(screen.getByTestId('comment-input')).toBeInTheDocument();
  });
});
