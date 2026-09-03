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
  default: ({
    alt,
    src,
    height,
  }: {
    alt: string;
    src: string | { src: string };
    height?: number;
  }) => <img alt={alt} src={typeof src === 'string' ? src : src.src} height={height} />,
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

  it('TS-24 (S-052): renderiza la firma Jiku con alt accesible y src que no es .png', () => {
    render(<Navbar />);

    const logo = screen.getByAltText('Jiku');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).not.toMatch(/\.png/);
  });

  it('TS-25 (S-052): la firma del sidebar se sirve a 26px de alto (antes 55)', () => {
    render(<Navbar />);

    const logo = screen.getByAltText('Jiku');
    expect(logo.getAttribute('height')).toBe('26');
  });
});
