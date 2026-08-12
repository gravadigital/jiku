import { render, screen, fireEvent } from '@testing-library/react';
import { MobileMenu } from '@/shared/components/layout/MobileMenu';
import { signOut } from 'next-auth/react';
import { vi, type Mock } from 'vitest';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

describe('MobileMenu', () => {
  const mockProjects = [
    { id: 1, label: 'Proyecto 1' },
    { id: 2, label: 'Proyecto 2' },
  ];

  const mockOnClose = vi.fn();
  const mockOnProjectSelect = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnProjectSelect.mockClear();
    (signOut as Mock).mockClear();
  });

  it('no renderiza cuando isOpen es false', () => {
    render(
      <MobileMenu
        isOpen={false}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza cuando isOpen es true', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renderiza el botón de cierre', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toBeInTheDocument();
  });

  it('cierra el menú cuando se hace clic en el botón X', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renderiza el dropdown de Proyectos', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
  });

  it('renderiza el link Suscriptores', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    expect(screen.getByText('Suscriptores')).toBeInTheDocument();
  });

  it('renderiza el botón Nueva tarea', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toBeInTheDocument();
  });

  it('renderiza el botón Cerrar sesión', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    expect(screen.getByRole('button', { name: /Cerrar sesión/i })).toBeInTheDocument();
  });

  it('llama a signOut cuando se hace clic en Cerrar sesión', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/i }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });

  it('cierra el menú al presionar Escape', () => {
    render(
      <MobileMenu
        isOpen={true}
        onClose={mockOnClose}
        projects={mockProjects}
        onProjectSelect={mockOnProjectSelect}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
