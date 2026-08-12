import { render, screen } from '@testing-library/react';
import { RequirementGroupRow } from './RequirementGroupRow';
import { vi } from 'vitest';

describe('RequirementGroupRow', () => {
  it('muestra el label vigente para los 2 estados nuevos', () => {
    render(
      <RequirementGroupRow state="planificacion" count={2} isCollapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByText('Planificación')).toBeInTheDocument();
  });

  it('muestra "En cola" para el estado en_cola', () => {
    render(
      <RequirementGroupRow state="en_cola" count={0} isCollapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByText('En cola')).toBeInTheDocument();
  });

  it('muestra "Resuelto" y no "Finalizado" para el estado resuelto', () => {
    render(
      <RequirementGroupRow state="resuelto" count={1} isCollapsed={false} onToggle={vi.fn()} />
    );
    expect(screen.getByText('Resuelto')).toBeInTheDocument();
    expect(screen.queryByText('Finalizado')).not.toBeInTheDocument();
  });
});
