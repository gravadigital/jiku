import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Projects from './page';

// El barrel de @/shared/components/ui arrastra CommentEditor -> next-auth/react, y el
// botón "Nuevo proyecto" (ViewHeader.action con href) usa useRouter. Mismo patrón que
// ui/index.test.ts documenta para el barrel completo.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

vi.mock('@/features/projects', () => ({
  ProjectListFilters: () => <div>filtros</div>,
  ProjectsBoard: () => <div>tablero</div>,
}));

describe('Projects (listado) — TS-98/S-060: cabecera migrada a ViewHeader', () => {
  it('muestra el título "Proyectos" como <h1> y el botón "Nuevo proyecto"', async () => {
    const searchParams = Promise.resolve({});
    render(await Projects({ searchParams }));

    expect(screen.getByRole('heading', { level: 1, name: 'Proyectos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo proyecto' })).toBeInTheDocument();
  });
});
