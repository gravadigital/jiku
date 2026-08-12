import { render, screen } from '@testing-library/react';
import { MobileRequirementsBoard, MOBILE_STATES_ORDER } from './MobileRequirementsBoard';

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
});
