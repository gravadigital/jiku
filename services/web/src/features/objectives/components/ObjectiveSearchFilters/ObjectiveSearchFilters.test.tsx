import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectiveSearchFilters } from './ObjectiveSearchFilters';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

vi.mock('@/features/auth', () => ({
  getPersons: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/projects', () => ({
  getProjects: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => vi.clearAllMocks());

describe('ObjectiveSearchFilters', () => {
  it('TS-4 (S-067): muestra el placeholder "Buscar tarea" en vez de "Buscar objetivo"', () => {
    render(<ObjectiveSearchFilters />);

    expect(screen.getByPlaceholderText('Buscar tarea')).toBeInTheDocument();
  });

  it('S-056 TS-2: el buscador es un Input variant search con label real', () => {
    render(<ObjectiveSearchFilters />);

    const search = screen.getByRole('textbox', { name: 'Búsqueda' });
    expect(search).toBeInTheDocument();
  });

  it('S-056 TS-3: los filtros usan Select del DS con combobox y opciones', async () => {
    const user = userEvent.setup();
    render(<ObjectiveSearchFilters />);

    const stateFilter = screen.getByRole('combobox', { name: 'Estados' });
    expect(stateFilter).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Proyecto' }));
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });
});
