import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './page';

describe('home (app/page.tsx) — TS-1 migración a tokens del DS', () => {
  it('renderiza el h1 "Home"', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
  });

  it('el h1 usa la clase del módulo scss (escala del DS), no el estilo de elemento global', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Home' });
    expect(heading.className).toMatch(/title/);
  });

  // TS-33 (S-059): las rutas públicas no montan el selector de tema (vive en el shell de (loggedin)).
  it('S-059 TS-33: no monta el selector de tema (no hay sidebar en esta ruta)', () => {
    render(<App />);
    expect(screen.queryByRole('radiogroup', { name: 'Tema' })).not.toBeInTheDocument();
  });
});
