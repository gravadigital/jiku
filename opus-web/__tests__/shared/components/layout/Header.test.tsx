import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/shared/components/layout/Header';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { signOut } from 'next-auth/react';
import { useProjects } from '@/features/projects';
import { useRouter } from 'next/navigation';
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
  useRouter: vi.fn(),
}));

const mockUseProjects = useProjects as Mock;
const mockUseRouter = useRouter as Mock;

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

describe('Header', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    (signOut as Mock).mockClear();
    mockPush.mockClear();
    mockUseRouter.mockReturnValue({
      push: mockPush,
    });
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

  it('renderiza el logo Opus', () => {
    render(<Header />, { wrapper: createWrapper() });
    expect(screen.getByText('Opus')).toBeInTheDocument();
  });

  it('renderiza el dropdown de Proyectos', () => {
    render(<Header />, { wrapper: createWrapper() });
    expect(screen.getByText('Proyectos')).toBeInTheDocument();
  });

  it('renderiza el link Suscriptores', () => {
    render(<Header />, { wrapper: createWrapper() });
    expect(screen.getByText('Suscriptores')).toBeInTheDocument();
  });

  it('renderiza el botón Nueva tarea', () => {
    render(<Header />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: 'Nueva tarea' })).toBeInTheDocument();
  });

  it('renderiza el botón de logout', () => {
    render(<Header />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('llama a signOut cuando se hace click en logout', () => {
    render(<Header />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });

  it('muestra estado de carga cuando isLoading es true', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<Header />, { wrapper: createWrapper() });
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('muestra estado de error cuando hay un error', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
      refetch: vi.fn(),
    });
    render(<Header />, { wrapper: createWrapper() });
    expect(screen.getByText('Error al cargar proyectos')).toBeInTheDocument();
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });

  it('llama a refetch cuando se hace click en reintentar', () => {
    const mockRefetch = vi.fn();
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
      refetch: mockRefetch,
    });
    render(<Header />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Reintentar'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('navega a requirements cuando se selecciona un proyecto', () => {
    render(<Header />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Proyectos'));
    fireEvent.click(screen.getByText('Proyecto Alpha'));

    expect(mockPush).toHaveBeenCalledWith('/projects/1/requirements');
  });

  it('muestra los proyectos en el dropdown al abrirlo', () => {
    render(<Header />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Proyectos'));

    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
    expect(screen.getByText('Proyecto Beta')).toBeInTheDocument();
  });
});
