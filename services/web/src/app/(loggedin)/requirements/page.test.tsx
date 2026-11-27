import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Requirements from './page';
import type { RequirementFilters } from '@/features/requirements/types/requirement.types';

let receivedFilters: RequirementFilters | undefined;

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/requirements',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { roles: [] } } }),
  signOut: vi.fn(),
}));
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock('@/features/requirements', () => ({
  RequirementList: ({ filters }: { filters: RequirementFilters }) => {
    receivedFilters = filters;
    return <div>tabla</div>;
  },
}));

describe('Requirements (listado)', () => {
  it('TS-98 (S-060): muestra el título "Requisitos" como <h1> y el botón "Nuevo requisito"', async () => {
    const searchParams = Promise.resolve({});
    render(await Requirements({ searchParams }));

    expect(screen.getByRole('heading', { level: 1, name: 'Requisitos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo requisito' })).toBeInTheDocument();
  });

  it('propaga el parámetro "search" de la URL a los filtros de RequirementList', async () => {
    const searchParams = Promise.resolve({ search: 'login' });
    render(await Requirements({ searchParams }));

    expect(screen.getByText('tabla')).toBeInTheDocument();
    expect(receivedFilters?.search).toBe('login');
  });

  it('usa null como search cuando no viene en la URL', async () => {
    const searchParams = Promise.resolve({});
    render(await Requirements({ searchParams }));

    expect(receivedFilters?.search).toBeNull();
  });

  // TS-1 (S-041/CA-1): sin `state` en la URL, aplica el default de cuatro estados
  it('TS-1: sin "state" en la URL aplica el default de cuatro estados (S-041)', async () => {
    const searchParams = Promise.resolve({});
    render(await Requirements({ searchParams }));

    expect(receivedFilters?.state).toBe('planificacion,en_cola,desarrollo,revision');
  });

  // TS-2 (S-041/CA-5): con `state` explícito en la URL, se respeta sin pisarlo con el default
  it('TS-2: respeta el "state" explícito de la URL y no lo pisa con el default (S-041)', async () => {
    const searchParams = Promise.resolve({ state: 'desarrollo,revision' });
    render(await Requirements({ searchParams }));

    expect(receivedFilters?.state).toBe('desarrollo,revision');
  });

  // TS-3 (S-041/CA-4): el sentinel `all` se propaga tal cual, sin convertirse en el default
  it('TS-3: propaga el sentinel "all" sin convertirlo en el default (S-041)', async () => {
    const searchParams = Promise.resolve({ state: 'all' });
    render(await Requirements({ searchParams }));

    expect(receivedFilters?.state).toBe('all');
  });

  // TS-3 (S-045/CA-3): include=totalMinutes es fijo, no viene de la URL
  it('TS-3: fija "include=totalMinutes" sin leerlo de la URL (S-045)', async () => {
    const searchParams = Promise.resolve({});
    render(await Requirements({ searchParams }));

    expect(receivedFilters?.include).toBe('totalMinutes');
    expect(receivedFilters?.state).toBe('planificacion,en_cola,desarrollo,revision');
    expect(receivedFilters?.page).toBe(1);
    expect(receivedFilters?.limit).toBe(15);
  });
});
