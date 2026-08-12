import { render, screen } from '@testing-library/react';
import { ListView, LIST_SECTIONS } from './ListView';
import { vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { roles: ['external-user'] } } }),
}));

describe('LIST_SECTIONS', () => {
  it('tiene las 7 secciones vigentes en el orden correcto', () => {
    expect(LIST_SECTIONS).toEqual([
      { id: 'analisis', title: 'Análisis', stateLabel: 'Análisis' },
      { id: 'planificacion', title: 'Planificación', stateLabel: 'Planificación' },
      { id: 'en_cola', title: 'En cola', stateLabel: 'En cola' },
      { id: 'desarrollo', title: 'Desarrollo', stateLabel: 'Desarrollo' },
      { id: 'revision', title: 'Revisión', stateLabel: 'Revisión' },
      { id: 'resuelto', title: 'Resuelto', stateLabel: 'Resuelto' },
      { id: 'cancelado', title: 'Cancelado', stateLabel: 'Cancelado' },
    ]);
  });
});

describe('ListView', () => {
  it('renderiza un RequirementGroupRow por cada una de las 7 secciones vigentes', () => {
    render(<ListView sections={{}} projectId={1} />);
    expect(screen.getByText('Análisis')).toBeInTheDocument();
    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.getByText('En cola')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    expect(screen.getByText('Revisión')).toBeInTheDocument();
    expect(screen.getByText('Resuelto')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });
});
