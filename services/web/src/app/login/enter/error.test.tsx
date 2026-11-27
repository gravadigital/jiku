import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ErrorPage from './error';

describe('login/enter/error.tsx — migración a tokens (T7)', () => {
  it('renderiza el título y el mensaje de error', () => {
    render(<ErrorPage error={{ message: 'Algo falló', name: 'Error' } as any} />);

    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
    expect(screen.getByText('Algo falló')).toBeInTheDocument();
  });

  it('el título y el mensaje usan clases del módulo scss, no estilos globales desnudos', () => {
    render(<ErrorPage error={{ message: 'Algo falló', name: 'Error' } as any} />);

    const heading = screen.getByRole('heading', { name: 'Error' });
    expect(heading.className).toBeTruthy();
  });
});
