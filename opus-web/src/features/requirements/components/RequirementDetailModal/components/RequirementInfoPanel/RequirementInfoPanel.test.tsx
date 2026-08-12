import { render, screen } from '@testing-library/react';
import { RequirementInfoPanel } from './RequirementInfoPanel';
import type { RequirementDetail, RequirementState } from '../../../../types/requirement.types';

function buildRequirement(overrides: Partial<RequirementDetail> = {}): RequirementDetail {
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
    requirementActivity: [],
    subscriptors: [],
    ...overrides,
  };
}

describe('RequirementInfoPanel', () => {
  it('muestra "Resuelto" y no "Finalizado" para el estado resuelto', () => {
    render(<RequirementInfoPanel requirement={buildRequirement({ state: 'resuelto' })} />);
    expect(screen.queryByText('Finalizado')).not.toBeInTheDocument();
    expect(screen.queryByText('Programado')).not.toBeInTheDocument();
    expect(screen.getByText('Resuelto')).toBeInTheDocument();
  });

  it('muestra "En cola" para el estado en_cola', () => {
    render(
      <RequirementInfoPanel
        requirement={buildRequirement({ state: 'en_cola' as RequirementState })}
      />
    );
    expect(screen.getByText('En cola')).toBeInTheDocument();
  });

  it('muestra "Funcionalidad" (no "funcionalidad") para el tipo funcionalidad', () => {
    render(<RequirementInfoPanel requirement={buildRequirement({ type: 'funcionalidad' })} />);
    expect(screen.getByText('Funcionalidad')).toBeInTheDocument();
    expect(screen.queryByText('funcionalidad')).not.toBeInTheDocument();
  });

  it('muestra "Sin tipo" (no "sin_tipo") cuando el tipo es sin_tipo', () => {
    render(<RequirementInfoPanel requirement={buildRequirement({ type: 'sin_tipo' })} />);
    expect(screen.getByText('Sin tipo')).toBeInTheDocument();
    expect(screen.queryByText('sin_tipo')).not.toBeInTheDocument();
  });

  it('muestra el bloque "Resolución" cuando hay nota cargada en una incidencia (TS-1)', () => {
    render(
      <RequirementInfoPanel
        requirement={buildRequirement({
          type: 'incidencia',
          resolutionComment: 'El problema fue resuelto, gracias por reportarlo',
        })}
      />
    );
    expect(screen.getByText('Resolución')).toBeInTheDocument();
    expect(
      screen.getByText('El problema fue resuelto, gracias por reportarlo')
    ).toBeInTheDocument();
  });

  it('nunca expone resolutionType ni resolutionConclusion en el DOM (TS-2)', () => {
    const requirement = {
      ...buildRequirement({ type: 'incidencia', resolutionComment: 'nota' }),
      resolutionType: 'error_interno',
      resolutionConclusion: 'conclusión interna',
    } as RequirementDetail;

    render(<RequirementInfoPanel requirement={requirement} />);
    expect(screen.queryByText('error_interno')).not.toBeInTheDocument();
    expect(screen.queryByText('conclusión interna')).not.toBeInTheDocument();
  });

  it('no muestra el bloque "Resolución" si no hay nota cargada (TS-3)', () => {
    render(
      <RequirementInfoPanel
        requirement={buildRequirement({ type: 'incidencia', resolutionComment: null })}
      />
    );
    expect(screen.queryByText('Resolución')).not.toBeInTheDocument();
  });

  it('no muestra el bloque "Resolución" para tipos distintos de incidencia, aunque haya nota (TS-4)', () => {
    render(
      <RequirementInfoPanel
        requirement={buildRequirement({
          type: 'funcionalidad',
          resolutionComment: 'nota que no debería verse',
        })}
      />
    );
    expect(screen.queryByText('nota que no debería verse')).not.toBeInTheDocument();
  });

  it('muestra el bloque "Resolución" sin depender de state === "resuelto" (TS-5)', () => {
    render(
      <RequirementInfoPanel
        requirement={buildRequirement({
          type: 'incidencia',
          state: 'desarrollo',
          resolutionComment: 'nota cargada antes de resolver',
        })}
      />
    );
    expect(screen.getByText('nota cargada antes de resolver')).toBeInTheDocument();
  });

  it('no muestra el bloque "Resolución" si es incidencia sin nota, en cualquier estado (TS-6)', () => {
    render(
      <RequirementInfoPanel
        requirement={buildRequirement({
          type: 'incidencia',
          state: 'analisis',
          resolutionComment: null,
        })}
      />
    );
    expect(screen.queryByText('Resolución')).not.toBeInTheDocument();
  });
});
