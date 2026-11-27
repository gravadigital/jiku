import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Objectives from './page';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/auth', () => ({ getPersons: vi.fn().mockResolvedValue([]) }));
vi.mock('@/features/projects', () => ({ getProjects: vi.fn().mockResolvedValue([]) }));
vi.mock('@/features/objectives', async () => {
  const actual = await vi.importActual<object>('@/features/objectives');
  return {
    ...actual,
    ObjectivesTable: () => <div>tabla</div>,
  };
});

describe('Objectives (listado)', () => {
  it('TS-2 (S-067): muestra título "Tareas" y botón "Nueva tarea"', async () => {
    const searchParams = Promise.resolve({});
    render(await Objectives({ searchParams }));

    expect(screen.getByRole('heading', { name: 'Tareas' })).toBeInTheDocument();
    expect(screen.getByText('Nueva tarea')).toBeInTheDocument();
  });
});
