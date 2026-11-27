import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardLayout from '@/app/(dashboard)/layout';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { useProjects } from '@/features/projects';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi, type Mock } from 'vitest';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: {
      user: { id: '123', roles: ['external-user'] },
    },
    status: 'authenticated',
  })),
}));

vi.mock('@/features/projects', () => ({
  useProjects: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
  usePathname: vi.fn(() => '/projects/1/objectives'),
}));

const mockUseProjects = useProjects as Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ProjectProvider>{children}</ProjectProvider>
      </QueryClientProvider>
    );
  };
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    mockUseProjects.mockReturnValue({
      data: [
        { id: 1, name: 'Proyecto Alpha' },
        { id: 2, name: 'Proyecto Beta' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renderiza el Header', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      </Wrapper>
    );
    expect(screen.getByText('Opus')).toBeInTheDocument();
  });

  it('renderiza children correctamente', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <DashboardLayout>
          <div data-testid="child">Child Content</div>
        </DashboardLayout>
      </Wrapper>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renderiza los elementos de navegación del Header', () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <DashboardLayout>
          <div>Content</div>
        </DashboardLayout>
      </Wrapper>
    );
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
  });

  // TS-24 — presencia de bloques por viewport. Es la ÚNICA diferencia de presencia entre
  // mobile y desktop en el detalle de requisito: el resto del cambio de S-007 (el bloque
  // de progreso) aparece igual en los dos.
  describe('TS-24: el chrome de navegación existe en desktop y no en mobile', () => {
    it('el shell monta el Sidebar', () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <DashboardLayout>
            <div>contenido</div>
          </DashboardLayout>
        </Wrapper>
      );

      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('bajo 768px el Sidebar se oculta por CSS, sin reemplazo montado', () => {
      const sidebarStyles = readFileSync(
        join(process.cwd(), 'src/features/projects/components/Sidebar/Sidebar.module.scss'),
        'utf-8'
      );

      // El corte de la superficie es 768px y pasa por el mixin, no por una @media cruda.
      expect(sidebarStyles).toMatch(/@include mobile\s*\{[^}]*display:\s*none/);
      expect(sidebarStyles).not.toMatch(/@media\s*\(max-width/);
    });
  });
});
