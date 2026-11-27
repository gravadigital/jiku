import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as useObjectivesModule from '@/features/objectives/hooks/useObjectives';
import { ProjectObjectivesSection } from './ProjectObjectivesSection';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/objectives/hooks/useObjectives');

describe('ProjectObjectivesSection', () => {
  it('TS-25 (S-067): título "Tareas", aria-labels y "No se encontraron tareas"', () => {
    vi.mocked(useObjectivesModule.useObjectives).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useObjectivesModule.useObjectives>);

    render(<ProjectObjectivesSection projectId={1} />);

    expect(screen.getByRole('heading', { name: 'Tareas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByText('No se encontraron tareas')).toBeInTheDocument();
  });

  it('el Table muestra el indicador de carga del DS mientras el listado está pendiente', () => {
    vi.mocked(useObjectivesModule.useObjectives).mockReturnValue({
      data: [],
      isLoading: true,
    } as unknown as ReturnType<typeof useObjectivesModule.useObjectives>);

    render(<ProjectObjectivesSection projectId={1} />);

    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });
});
