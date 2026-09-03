import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ErrorPageContent } from './ErrorPageContent';

describe('ErrorPageContent — TS-113/TS-114 (S-060 T7)', () => {
  it('TS-113/TS-114: renderiza "Error" como heading de nivel 1, con clase propia', () => {
    render(<ErrorPageContent message="Error inesperado" />);

    const heading = screen.getByRole('heading', { level: 1, name: 'Error' });
    expect(heading).toBeInTheDocument();
  });

  it('TS-114: muestra el mensaje de error recibido', () => {
    render(<ErrorPageContent message="Algo salió mal" />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });
});
