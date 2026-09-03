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
});
