import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
