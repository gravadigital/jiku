import { render, screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { KanbanCard } from './KanbanCard';
import { vi, type Mock } from 'vitest';
import type {
  Requirement,
  RequirementState,
} from '@/features/requirements/types/requirement.types';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/features/requirements/hooks/useUpdateRequirement', () => ({
  useUpdateRequirement: () => ({ mutate: vi.fn() }),
}));

const mockUseSession = useSession as Mock;

function buildRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: 1,
    title: 'Requisito de prueba',
    description: 'desc',
    type: 'funcionalidad',
    priority: 'media',
    state: 'planificacion',
    estimatedFinishDate: null,
    tags: [],
    projectId: 1,
    scheduledAt: null,
    inProgressAt: null,
    inReviewAt: null,
    finishedAt: null,
    resolutionComment: null,
    creator: { id: 'u1', name: 'Juan Pérez', email: 'juan@x.com' },
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('KanbanCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza Dropdown de estado para cliente externo (solo lectura)', () => {
    mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
    render(
      <KanbanCard
        requirement={buildRequirement({ state: 'planificacion' })}
        stateLabel="Planificación"
      />
    );
    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Planificación/ })).not.toBeInTheDocument();
  });

  it('renderiza Dropdown con los 7 estados para usuario interno', () => {
    mockUseSession.mockReturnValue({ data: { user: { roles: ['user'] } } });
    render(
      <KanbanCard requirement={buildRequirement({ state: 'en_cola' })} stateLabel="En cola" />
    );
    expect(screen.getByRole('button', { name: /En cola/ })).toBeInTheDocument();
  });

  it('no lanza excepción con un estado desconocido', () => {
    mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
    expect(() =>
      render(
        <KanbanCard
          requirement={buildRequirement({ state: 'estado_inexistente' as RequirementState })}
          stateLabel="???"
        />
      )
    ).not.toThrow();
    expect(screen.getByText('???')).toBeInTheDocument();
  });
});
