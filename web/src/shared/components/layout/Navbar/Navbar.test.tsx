import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Navbar } from './Navbar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/requirements',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { roles: [] } } }),
  signOut: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe('Navbar', () => {
  it('no muestra el subItem "Reporte" bajo "Requisitos" (movido a un botón en la página de listado)', () => {
    render(<Navbar />);

    expect(screen.queryByRole('link', { name: /reporte/i })).not.toBeInTheDocument();
  });

  it('el item "Requisitos" sigue enlazando a /requirements', () => {
    render(<Navbar />);

    const requirementsLinks = screen.getAllByRole('link', { name: /requisitos/i });
    expect(requirementsLinks.some((link) => link.getAttribute('href') === '/requirements')).toBe(
      true
    );
  });

  it('TS-1 (S-067): muestra "Tareas" en vez de "Objetivos" y el href a /objectives no cambia', () => {
    render(<Navbar />);

    expect(screen.getByText('Tareas')).toBeInTheDocument();
    expect(screen.queryByText('Objetivos')).not.toBeInTheDocument();

    const taskLinks = screen.getAllByRole('link', { name: /tareas/i });
    expect(taskLinks.some((link) => link.getAttribute('href') === '/objectives')).toBe(true);
  });
});
