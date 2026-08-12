import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TintedIcon } from './TintedIcon';

describe('TintedIcon', () => {
  it('renderiza un span con role img, el alt dado y el color por defecto #DA2C6A', () => {
    render(<TintedIcon src="/fake-icon.svg" alt="Proyecto" />);

    const icon = screen.getByRole('img', { name: 'Proyecto' });
    expect(icon).toBeInTheDocument();
    expect(icon.style.backgroundColor).toBe('rgb(218, 44, 106)');
  });

  it('permite sobreescribir el color', () => {
    render(<TintedIcon src="/fake-icon.svg" alt="Requisito" color="#000000" />);

    const icon = screen.getByRole('img', { name: 'Requisito' });
    expect(icon.style.backgroundColor).toBe('rgb(0, 0, 0)');
  });
});
