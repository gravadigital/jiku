import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UnauthorizedPage from './page';

vi.mock('@/lib/auth', () => ({ signOut: vi.fn() }));

describe('UnauthorizedPage (sin-permisos)', () => {
  it('TS-4 (S-034): renderiza el corte por rol con sus tres bloques de contenido', () => {
    render(<UnauthorizedPage />);

    expect(screen.getByRole('heading', { name: /Acceso no autorizado/i })).toBeInTheDocument();
    expect(screen.getByText(/no tiene permisos para acceder/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/i })).toBeInTheDocument();
  });
});
