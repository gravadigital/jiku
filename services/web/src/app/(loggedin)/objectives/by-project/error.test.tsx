import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ErrorPage from './error';

describe('objectives/by-project/error — TS-113/TS-114 (S-060 T7)', () => {
  it('sigue anunciando el error con heading de nivel 1 y el mensaje fijo', () => {
    render(<ErrorPage error={{ message: 'no usado' } as any} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Error' })).toBeInTheDocument();
    expect(screen.getByText('Error inesperado')).toBeInTheDocument();
  });
});
