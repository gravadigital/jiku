import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectList } from '@/features/projects/components/ProjectList';
import type { Project } from '@/features/projects';
import { vi } from 'vitest';

describe('ProjectList', () => {
  const mockProjects: Project[] = [
    { id: 1, name: 'Proyecto Alpha' },
    { id: 2, name: 'Proyecto Beta' },
    { id: 3, name: 'Proyecto Gamma' },
  ];

  const mockOnSelectProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el número correcto de ProjectCards', () => {
    render(<ProjectList projects={mockProjects} onSelectProject={mockOnSelectProject} />);
    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(3);
  });

  it('renderiza cada proyecto con su nombre', () => {
    render(<ProjectList projects={mockProjects} onSelectProject={mockOnSelectProject} />);
    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
    expect(screen.getByText('Proyecto Beta')).toBeInTheDocument();
    expect(screen.getByText('Proyecto Gamma')).toBeInTheDocument();
  });

  it('propaga onSelectProject correctamente al hacer click en una tarjeta', () => {
    render(<ProjectList projects={mockProjects} onSelectProject={mockOnSelectProject} />);
    fireEvent.click(screen.getByText('Proyecto Beta'));
    expect(mockOnSelectProject).toHaveBeenCalledTimes(1);
    expect(mockOnSelectProject).toHaveBeenCalledWith(mockProjects[1]);
  });

  it('renderiza lista vacía sin errores cuando projects = []', () => {
    render(<ProjectList projects={[]} onSelectProject={mockOnSelectProject} />);
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('tiene role="list" para accesibilidad', () => {
    render(<ProjectList projects={mockProjects} onSelectProject={mockOnSelectProject} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
