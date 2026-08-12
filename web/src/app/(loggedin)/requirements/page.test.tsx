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
});
