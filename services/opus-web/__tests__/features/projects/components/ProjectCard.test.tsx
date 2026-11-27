import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import type { Project } from '@/features/projects';
import { vi } from 'vitest';

describe('ProjectCard', () => {
  const mockProject: Project = {
    id: 1,
    name: 'Proyecto Alpha',
  };

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el nombre del proyecto', () => {
    render(<ProjectCard project={mockProject} onSelect={mockOnSelect} />);
    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
  });

  it('llama onSelect con el proyecto al hacer click', () => {
    render(<ProjectCard project={mockProject} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(mockProject);
  });

  it('llama onSelect al presionar Enter', () => {
    render(<ProjectCard project={mockProject} onSelect={mockOnSelect} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(mockProject);
  });

  it('llama onSelect al presionar Space', () => {
    render(<ProjectCard project={mockProject} onSelect={mockOnSelect} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(mockProject);
  });

  it('no llama onSelect al presionar otras teclas', () => {
    render(<ProjectCard project={mockProject} onSelect={mockOnSelect} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('tiene los atributos de accesibilidad correctos', () => {
    render(<ProjectCard project={mockProject} onSelect={mockOnSelect} />);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('tabIndex', '0');
    expect(card).toHaveAttribute('aria-label', 'Seleccionar proyecto Proyecto Alpha');
  });
});
