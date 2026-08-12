import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectiveStateFilter } from './ObjectiveStateFilter';
import type { ObjectiveState } from '@/features/objectives/types/objective.types';

vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ObjectiveStateFilter', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza 4 chips con los labels correctos', () => {
    render(<ObjectiveStateFilter selectedStates={[]} onChange={onChange} />);
    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('En revisión')).toBeInTheDocument();
  });

  it('chip individual activo tiene data-active="true"', () => {
    render(<ObjectiveStateFilter selectedStates={['activo']} onChange={onChange} />);
    const activoChip = screen.getByText('Activo').closest('button');
    expect(activoChip).toHaveAttribute('data-active', 'true');
    const backlogChip = screen.getByText('Backlog').closest('button');
    expect(backlogChip).toHaveAttribute('data-active', 'false');
  });

  it('click en chip individual agrega el estado si no estaba seleccionado', async () => {
    render(<ObjectiveStateFilter selectedStates={['activo']} onChange={onChange} />);
    await userEvent.click(screen.getByText('Backlog'));
    expect(onChange).toHaveBeenCalledWith(['activo', 'backlog']);
  });

  it('click en chip individual quita el estado si ya estaba seleccionado', async () => {
    render(<ObjectiveStateFilter selectedStates={['activo', 'backlog']} onChange={onChange} />);
    await userEvent.click(screen.getByText('Backlog'));
    expect(onChange).toHaveBeenCalledWith(['activo']);
  });

  it('click en "Todos" con ninguno seleccionado llama onChange con los 3 estados', async () => {
    render(<ObjectiveStateFilter selectedStates={[]} onChange={onChange} />);
    await userEvent.click(screen.getByText('Todos'));
    expect(onChange).toHaveBeenCalledWith(['backlog', 'activo', 'en_revision'] as ObjectiveState[]);
  });

  it('click en "Todos" con todos seleccionados llama onChange con array vacío', async () => {
    render(
      <ObjectiveStateFilter
        selectedStates={['backlog', 'activo', 'en_revision']}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByText('Todos'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('click en "Todos" con algunos seleccionados llama onChange con los 3 estados', async () => {
    render(<ObjectiveStateFilter selectedStates={['activo']} onChange={onChange} />);
    await userEvent.click(screen.getByText('Todos'));
    expect(onChange).toHaveBeenCalledWith(['backlog', 'activo', 'en_revision'] as ObjectiveState[]);
  });
});
