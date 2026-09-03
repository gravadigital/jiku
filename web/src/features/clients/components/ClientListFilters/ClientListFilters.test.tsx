import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClientListFilters } from './ClientListFilters';

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));
// El barrel completo de @/shared/components/ui arrastra (vía CommentEditor →
// @/features/objectives) un uso de next-auth/react y de next-auth a nivel de módulo.
// Sin estos mocks la resolución real de 'next/server' desde next-auth/lib/env.js falla
// en este entorno de test. Mismo patrón que shared/components/ui/index.test.ts.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

describe('ClientListFilters', () => {
  it('el buscador es un Input variant search con label real (TS-2)', () => {
    render(<ClientListFilters />);

    const search = screen.getByLabelText(/búsqueda/i);
    expect(search).toBeInTheDocument();
    expect(search.tagName).toBe('INPUT');
    expect(search).toHaveAttribute('placeholder', 'Buscar actor');
  });

  it('los filtros de estado y orden son Select del DS (TS-3)', async () => {
    render(<ClientListFilters />);

    const estado = screen.getByRole('combobox', { name: 'Estado' });
    await userEvent.click(estado);

    expect(estado).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    expect(document.querySelector('select')).not.toBeInTheDocument();
  });
});
