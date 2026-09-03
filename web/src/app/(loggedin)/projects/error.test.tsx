import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ErrorPage from './error';

describe('projects/error — TS-113/TS-114 (S-060 T7)', () => {
  it('sigue anunciando el error con heading de nivel 1 y el mensaje recibido', () => {
    render(<ErrorPage error={{ message: 'Fallo al cargar proyectos' } as any} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Error' })).toBeInTheDocument();
    expect(screen.getByText('Fallo al cargar proyectos')).toBeInTheDocument();
  });
});
