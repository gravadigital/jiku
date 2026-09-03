import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TintedIcon } from './TintedIcon';

describe('TintedIcon', () => {
  // S-058 (TS-49): el default deja de ser el magenta descontinuado (#DA2C6A) y pasa al
  // grafito del DS (color.brand.graphite) vía token, no hex literal.
  it('renderiza un span con role img, el alt dado y el color grafito del DS por defecto', () => {
    render(<TintedIcon src="/fake-icon.svg" alt="Proyecto" />);

    const icon = screen.getByRole('img', { name: 'Proyecto' });
    expect(icon).toBeInTheDocument();
    expect(icon.style.backgroundColor).toBe('var(--color-graphite)');
  });

  it('permite sobreescribir el color', () => {
    render(<TintedIcon src="/fake-icon.svg" alt="Requisito" color="#000000" />);

    const icon = screen.getByRole('img', { name: 'Requisito' });
    expect(icon.style.backgroundColor).toBe('rgb(0, 0, 0)');
  });
});
