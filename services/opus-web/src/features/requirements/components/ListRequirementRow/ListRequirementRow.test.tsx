import { render, screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { ListRequirementRow } from './ListRequirementRow';
import type { Requirement } from '../../types/requirement.types';
import { vi, type Mock } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('../../hooks/useUpdateRequirement', () => ({
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
    state: 'en_cola',
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

describe('ListRequirementRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza Dropdown de estado para cliente externo (solo lectura)', () => {
    mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
    render(<ListRequirementRow requirement={buildRequirement()} stateLabel="En cola" />);
    expect(screen.getByText('En cola')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /En cola/ })).not.toBeInTheDocument();
  });

  it('renderiza Dropdown para usuario interno con los 7 estados', () => {
    mockUseSession.mockReturnValue({ data: { user: { roles: ['user'] } } });
    render(
      <ListRequirementRow
        requirement={buildRequirement({ state: 'planificacion' })}
        stateLabel="Planificación"
      />
    );
    expect(screen.getByRole('button', { name: /Planificación/ })).toBeInTheDocument();
  });

  it('muestra "Funcionalidad" (no "funcionalidad") en la columna Tipo', () => {
    mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
    render(
      <ListRequirementRow
        requirement={buildRequirement({ type: 'funcionalidad' })}
        stateLabel="En cola"
      />
    );
    expect(screen.getByText('Funcionalidad')).toBeInTheDocument();
    expect(screen.queryByText('funcionalidad')).not.toBeInTheDocument();
  });

  it('muestra "Sin tipo" (no "sin_tipo") cuando el tipo es sin_tipo', () => {
    mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
    render(
      <ListRequirementRow
        requirement={buildRequirement({ type: 'sin_tipo' })}
        stateLabel="En cola"
      />
    );
    expect(screen.getByText('Sin tipo')).toBeInTheDocument();
    expect(screen.queryByText('sin_tipo')).not.toBeInTheDocument();
  });
  describe('marca de identidad automática', () => {
    const servicio = {
      id: 'u-svc',
      name: 'Conector Portal',
      email: 'conector@grava.io',
      identityType: 'service' as const,
    };

    it('TS-9: la celda AUTOR muestra el nombre y la marca cuando el creador es una identidad de servicio', () => {
      mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
      render(
        <ListRequirementRow
          requirement={buildRequirement({ creator: servicio })}
          stateLabel="En cola"
        />
      );
      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getByText('Automático')).toBeInTheDocument();
    });

    it('TS-10: un creador que es una persona no lleva marca', () => {
      mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
      render(
        <ListRequirementRow
          requirement={buildRequirement({
            creator: { id: 'u1', name: 'Juan Pérez', email: 'juan@x.com', identityType: 'person' },
          })}
          stateLabel="En cola"
        />
      );
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-11: un creador sin identityType (api vieja) no lleva marca', () => {
      mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
      render(<ListRequirementRow requirement={buildRequirement()} stateLabel="En cola" />);
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-12: creator null sigue mostrando "—" y no lleva marca', () => {
      mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
      render(
        <ListRequirementRow
          requirement={buildRequirement({ creator: null })}
          stateLabel="En cola"
        />
      );
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-13: en una lista mixta solo la fila del servicio se marca', () => {
      mockUseSession.mockReturnValue({ data: { user: { roles: ['external-user'] } } });
      render(
        <>
          <ListRequirementRow
            requirement={buildRequirement({ id: 1, creator: servicio })}
            stateLabel="En cola"
          />
          <ListRequirementRow
            requirement={buildRequirement({
              id: 2,
              creator: {
                id: 'u1',
                name: 'Juan Pérez',
                email: 'juan@x.com',
                identityType: 'person',
              },
            })}
            stateLabel="En cola"
          />
        </>
      );
      const marcas = screen.getAllByText('Automático');
      expect(marcas).toHaveLength(1);
      // La marca vive en la misma celda que el nombre del servicio, no en la de la persona.
      expect(marcas[0].parentElement).toHaveTextContent('Conector Portal');
    });
  });
});
