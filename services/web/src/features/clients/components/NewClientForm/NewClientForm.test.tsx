import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewClientForm } from './NewClientForm';

// Ver nota en ClientListFilters.test.tsx: el barrel de @/shared/components/ui arrastra
// next-auth/next-auth-react a nivel de módulo vía CommentEditor.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));
// Button usa useRouter() de next/navigation como fallback de navegación por `href`.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('NewClientForm', () => {
  it('guarda una sola vez con el payload correcto al hacer click en Guardar (TS-5)', async () => {
    const onSubmit = vi.fn();
    render(<NewClientForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/^Nombre/), 'Grava Digital');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Grava Digital', description: '' });
  });

  it('el botón de guardar expone el estado de carga del DS (TS-6)', () => {
    render(<NewClientForm onSubmit={vi.fn()} loading />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
