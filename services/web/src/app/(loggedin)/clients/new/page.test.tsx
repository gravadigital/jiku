import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NewClient from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// El barrel de @/shared/components/ui arrastra CommentEditor -> next-auth/react. Mismo
// patrón que ui/index.test.ts documenta para el barrel completo.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

vi.mock('@/features/clients', () => ({
  NewClientForm: () => <div>formulario</div>,
  useCreateClient: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('NewClient — TS-98/S-060: cabecera migrada a ViewHeader', () => {
  it('muestra el título "Crear actor" como <h1>', () => {
    render(<NewClient />);

    expect(screen.getByRole('heading', { level: 1, name: 'Crear actor' })).toBeInTheDocument();
  });
});
