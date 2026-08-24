import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MobileRequirementsBoard, MOBILE_STATES_ORDER } from './MobileRequirementsBoard';
import type { Requirement } from '../../types/requirement.types';

function buildRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: 1,
    title: 'Requisito de prueba',
    description: 'desc',
    type: 'funcionalidad',
    priority: 'media',
    state: 'analisis',
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

describe('MOBILE_STATES_ORDER', () => {
  it('tiene las 7 secciones vigentes en el orden correcto', () => {
    expect(MOBILE_STATES_ORDER).toEqual([
      { id: 'analisis', title: 'Análisis' },
      { id: 'planificacion', title: 'Planificación' },
      { id: 'en_cola', title: 'En cola' },
      { id: 'desarrollo', title: 'Desarrollo' },
      { id: 'revision', title: 'Revisión' },
      { id: 'resuelto', title: 'Resuelto' },
      { id: 'cancelado', title: 'Cancelado' },
    ]);
  });
});

describe('MobileRequirementsBoard', () => {
  it('renderiza las 7 secciones del accordion', () => {
    render(<MobileRequirementsBoard states={{}} projectId={1} />);
    expect(screen.getByText('Análisis')).toBeInTheDocument();
    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.getByText('En cola')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    expect(screen.getByText('Revisión')).toBeInTheDocument();
    expect(screen.getByText('Resuelto')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });
  it('TS-17: la card de mobile no muestra autor ni la marca de identidad automática', async () => {
    const requirement = buildRequirement({
      creator: {
        id: 'u-svc',
        name: 'Conector Portal',
        email: 'conector@grava.io',
        identityType: 'service',
      },
    });
    render(
      <MobileRequirementsBoard
        states={{
          analisis: {
            requirements: [requirement],
            hasMore: false,
            isLoadingMore: false,
            onLoadMore: vi.fn(),
          },
        }}
        projectId={1}
      />
    );
    // Los acordeones arrancan colapsados: sin el click el test pasaria por la razon equivocada.
    await userEvent.click(screen.getByRole('button', { name: /Análisis/ }));
    expect(screen.getByText('Requisito de prueba')).toBeInTheDocument();
    expect(screen.queryByText('Conector Portal')).not.toBeInTheDocument();
    expect(screen.queryByText('Automático')).not.toBeInTheDocument();
  });
});
