import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Login from './page';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));

// El handoff de identidad especifica el login completo: además del wordmark, el título y el
// botón que S-058 ya migró, la columna izquierda lleva subtítulo, enlace de ayuda y pie, y el
// panel decorativo tiene valores concretos (halos al 50%/55%, trama de 18px, radio 22 y margen
// de 22px respecto del borde de la ventana).
const styles = fs.readFileSync(path.resolve(__dirname, './styles.module.scss'), 'utf8');

describe('login — contenido del handoff de identidad', () => {
  it('muestra el subtítulo de la columna izquierda', () => {
    render(<Login />);
    expect(
      screen.getByText(/Gestión de proyectos, requisitos y horas del equipo/i)
    ).toBeInTheDocument();
  });

  it('ofrece el enlace de ayuda para entrar', () => {
    render(<Login />);
    const help = screen.getByRole('link', { name: /Problemas para entrar/i });
    expect(help).toBeInTheDocument();
    expect(help).toHaveAttribute('href', expect.stringContaining('mailto:'));
  });

  it('cierra con el pie de uso interno', () => {
    render(<Login />);
    expect(screen.getByText(/USO INTERNO · GRAVA/i)).toBeInTheDocument();
  });

  it('el título sigue siendo el único h1 de la pantalla', () => {
    render(<Login />);
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenido' })).toBeInTheDocument();
  });
});

describe('login/styles.module.scss — panel decorativo del handoff', () => {
  it('el halo verde agua está al 50% de opacidad y llega al 46%', () => {
    expect(styles).toMatch(/rgba\(97,\s*204,\s*185,\s*0?\.5\)\s*0%?,\s*transparent\s*46%/);
  });

  it('el halo grafito está al 55% y llega al 52%', () => {
    expect(styles).toMatch(/rgba\(98,\s*108,\s*120,\s*0?\.55\)\s*0%?,\s*transparent\s*52%/);
  });

  it('la trama de puntos es de 18px, no de 16px', () => {
    expect(styles).toMatch(/18px\s+18px/);
    expect(styles).not.toMatch(/16px\s+16px/);
  });

  it('el panel tiene radio propio en las cuatro esquinas y margen respecto de la ventana', () => {
    // El handoff lo describe como una tarjeta separada del borde ("radio 22, margen 22px
    // respecto del borde de la ventana"), no como una mitad pegada al borde derecho. El valor
    // va por token (--login-panel-radius / --login-panel-inset) y no literal, porque 22px está
    // fuera de la escala de radios y el guardia de la migración exige token o valor de escala.
    expect(styles).toMatch(/border-radius:\s*var\(--login-panel-radius\)/);
    expect(styles).toMatch(/margin:\s*var\(--login-panel-inset\)/);
    expect(styles).not.toMatch(/border-top-left-radius:\s*20px/);
  });

  it('el panel usa la superficie de marca (azul oscuro fijo), no un hex ni el inverso del tema', () => {
    // --bg-brand-deep, no --bg-inverse: el azul del panel no cambia entre modos, mientras
    // --bg-inverse en oscuro se remapea a la superficie del tema (para overlays y tooltips).
    expect(styles).toMatch(/background-color:\s*var\(--bg-brand-deep\)/);
  });
});
