import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as useClientsModule from '@/features/clients/hooks/useClients';
import { ClientsBoard } from './ClientsBoard';
import type { Client, ClientFilters } from '@/features/clients/types/client.types';

vi.mock('@/features/clients/hooks/useClients');
// Ver nota en ClientListFilters.test.tsx: el barrel de @/shared/components/ui arrastra
// next-auth/next-auth-react a nivel de módulo vía CommentEditor.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function mockClients(data: Client[] | undefined, isLoading = false) {
  vi.mocked(useClientsModule.useClients).mockReturnValue({
    data,
    isLoading,
  } as unknown as ReturnType<typeof useClientsModule.useClients>);
}

const baseFilters: ClientFilters = { search: undefined, sort: 'status-name', status: undefined };

describe('ClientsBoard', () => {
  it('rinde las filas de actor con Card y Badge de estado (TS-1 dependencia)', () => {
    mockClients([{ id: 1, name: 'Grava', description: undefined, projects: [] }]);

    render(<ClientsBoard filters={baseFilters} />);

    expect(screen.getByText('Grava')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('el vacío con filtros activos usa EmptyState variant filtered, sin ofrecer crear (TS-4)', () => {
    mockClients([]);

    render(<ClientsBoard filters={{ ...baseFilters, search: 'no-existe' }} />);

    const status = screen.getByText(/no hay actores/i);
    const region = status.closest('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(within(region as HTMLElement).queryByRole('alert')).not.toBeInTheDocument();
    expect(region).not.toHaveAttribute('role', 'alert');
    expect(within(region as HTMLElement).queryByRole('button', { name: /nuevo actor/i })).toBeNull();
  });
});
