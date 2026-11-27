import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectListFilters } from './ProjectListFilters';

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

describe('ProjectListFilters', () => {
  it('el buscador y los tres filtros son Input/Select del DS', async () => {
    render(<ProjectListFilters />);

    expect(screen.getByLabelText(/búsqueda/i)).toBeInTheDocument();

    const tipo = screen.getByRole('combobox', { name: 'Tipo' });
    await userEvent.click(tipo);
    expect(tipo).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);

    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toBeInTheDocument();
    expect(document.querySelector('select')).not.toBeInTheDocument();
  });
});
