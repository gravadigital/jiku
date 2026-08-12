import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import * as useObjectivesModule from '@/features/objectives/hooks/useObjectives';
import { ProjectObjectivesSection } from './ProjectObjectivesSection';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/objectives/hooks/useObjectives');

describe('ProjectObjectivesSection', () => {
  it('TS-25 (S-067): título "Tareas", aria-labels y "No se encontraron tareas"', () => {
    vi.mocked(useObjectivesModule.useObjectives).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(<ProjectObjectivesSection projectId={1} />);

    expect(screen.getByText('Tareas')).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva tarea')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtro por estado de tarea')).toBeInTheDocument();
    expect(screen.getByText('No se encontraron tareas')).toBeInTheDocument();
  });

  it('TS-25 (S-067): muestra "Cargando tareas..." mientras carga', () => {
    vi.mocked(useObjectivesModule.useObjectives).mockReturnValue({
      data: [],
      isLoading: true,
    } as any);

    render(<ProjectObjectivesSection projectId={1} />);

    expect(screen.getByText('Cargando tareas...')).toBeInTheDocument();
  });
});
