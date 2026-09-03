import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EditClient from './page';

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

// Identidad estable entre renders: el hook real (TanStack Query) memoiza `data`, y el
// useEffect de la página depende de esa referencia — un objeto literal recreado en cada
// llamada del mock dispara un loop de renders (la referencia "cambia" en cada pasada).
const mockClientData = { id: 1, name: 'Actor de prueba', description: 'desc' };

vi.mock('@/features/clients', () => ({
  useClient: () => ({
    data: mockClientData,
    isLoading: false,
  }),
  useUpdateClient: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/features/clients/components/ClientForm/ClientForm', () => ({
  ClientForm: () => <div>formulario</div>,
}));

describe('EditClient — TS-98/S-060: cabecera migrada a ViewHeader', () => {
  it('muestra el título "Editar actor" como <h1>', async () => {
    await act(async () => {
      render(<EditClient params={Promise.resolve({ id: 1 })} />);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Editar actor' })).toBeInTheDocument();
    });
  });
});
