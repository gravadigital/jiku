import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as projectsApi from '@/features/projects/services/projectsApi';
import { ProjectsBoard } from './ProjectsBoard';
import type { Project } from '@/shared/types';

vi.mock('@/features/projects/services/projectsApi');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
// Ver nota en features/clients/.../ClientListFilters.test.tsx: el barrel de
// @/shared/components/ui arrastra next-auth/next-auth-react a nivel de módulo.
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));

const baseProject: Project = {
  id: 7,
  code: 'WM-01',
  name: 'WashMach',
  description: 'Lavado industrial',
  status: 'activo',
  type: 'comercial',
  priority: 2,
  initDate: new Date('2026-01-01'),
  endDate: new Date('2026-06-01'),
  creator: { id: 1, name: 'Someone' } as unknown as Project['creator'],
};

describe('ProjectsBoard', () => {
  it('cada proyecto expone exactamente un destino accesible con el href correcto (TS-7)', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([baseProject]);

    render(await ProjectsBoard({ filters: {} }));

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/projects/7');
    expect(links[0]).toHaveAccessibleName('WashMach');
  });

  it('el estado se comunica con punto + texto usando la familia de STATE_TO_FAMILY (TS-8)', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([baseProject]);

    const { container } = render(await ProjectsBoard({ filters: {} }));

    expect(screen.getByText('Activo')).toBeInTheDocument();
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('el vacío usa EmptyState variant filtered cuando hay filtros activos', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([]);

    render(await ProjectsBoard({ filters: { search: 'no-existe' } }));

    const message = screen.getByText(/no hay proyectos/i);
    const region = message.closest('[aria-live="polite"]');
    expect(region).not.toBeNull();
    expect(within(region as HTMLElement).queryByRole('button')).toBeNull();
  });
});
