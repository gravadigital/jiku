import { render, screen } from '@testing-library/react';
import { KanbanBoard, KANBAN_COLUMNS } from './KanbanBoard';
import { vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { roles: ['external-user'] } } }),
}));

describe('KANBAN_COLUMNS', () => {
  it('tiene las 7 columnas vigentes en el orden correcto', () => {
    expect(KANBAN_COLUMNS.map((c) => ({ id: c.id, title: c.title }))).toEqual([
      { id: 'analisis', title: 'Análisis' },
      { id: 'planificacion', title: 'Planificación' },
      { id: 'en_cola', title: 'En cola' },
      { id: 'desarrollo', title: 'Desarrollo' },
      { id: 'revision', title: 'Revisión' },
      { id: 'resuelto', title: 'Resuelto' },
      { id: 'cancelado', title: 'Cancelado' },
    ]);
  });

  it('colapsa por defecto Resuelto y Cancelado', () => {
    const resuelto = KANBAN_COLUMNS.find((c) => c.id === 'resuelto');
    const cancelado = KANBAN_COLUMNS.find((c) => c.id === 'cancelado');
    const analisis = KANBAN_COLUMNS.find((c) => c.id === 'analisis');
    expect(resuelto?.defaultCollapsed).toBe(true);
    expect(cancelado?.defaultCollapsed).toBe(true);
    expect(analisis?.defaultCollapsed).toBe(false);
  });
});

describe('KanbanBoard', () => {
  it('renderiza las 7 columnas', () => {
    render(<KanbanBoard columns={{}} projectId={1} />);
    expect(screen.getByText('Análisis')).toBeInTheDocument();
    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.getByText('En cola')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    expect(screen.getByText('Revisión')).toBeInTheDocument();
    expect(screen.getByText('Resuelto')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });
});
