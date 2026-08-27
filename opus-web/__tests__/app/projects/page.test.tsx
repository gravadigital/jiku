import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectsPage from '@/app/(dashboard)/projects/page';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { useProjects } from '@/features/projects';
import { useLogout } from '@/shared/hooks/useLogout';
import { vi, type Mock } from 'vitest';

const mockPush = vi.fn();

vi.mock('@/features/projects', async () => ({
  ...(await vi.importActual('@/features/projects')),
  useProjects: vi.fn(),
}));

vi.mock('@/contexts/ProjectContext', async () => ({
  ...(await vi.importActual('@/contexts/ProjectContext')),
  useActiveProject: vi.fn(() => ({
    activeProject: null,
    setActiveProject: vi.fn(),
  })),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
}));

vi.mock('@/shared/hooks/useLogout', () => ({
  useLogout: vi.fn(),
}));

const mockUseProjects = useProjects as Mock;
const mockUseLogout = useLogout as Mock;

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

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra Spinner cuando isLoading es true', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Cargando proyectos...')).toBeInTheDocument();
  });

  it('muestra mensaje de error cuando isError es true', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.getByText('Error al cargar los proyectos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('llama refetch cuando se hace click en Reintentar', () => {
    const mockRefetch = vi.fn();
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('muestra el encabezado nuevo cuando no hay proyectos', () => {
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(vi.fn());

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Todavía no tenés acceso a ningún proyecto' })
    ).toBeInTheDocument();
  });

  it('muestra el microcopy nuevo cuando no hay proyectos', () => {
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(vi.fn());

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(
      screen.getByText(
        'Cuando el equipo te dé acceso a un proyecto, lo vas a ver acá. Si esperabas verlo ahora, escribile a tu contacto en Grava Digital.'
      )
    ).toBeInTheDocument();
  });

  it('ya no muestra el texto viejo cuando no hay proyectos', () => {
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(vi.fn());

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.queryByText('No tienes proyectos asignados')).toBeNull();
  });

  it('muestra el botón de cerrar sesión con variant secondary cuando no hay proyectos', () => {
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(vi.fn());

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    const button = screen.getByRole('button', { name: 'Cerrar sesión' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-variant', 'secondary');
  });

  it('dispara useLogout al hacer click en Cerrar sesión', () => {
    const mockLogoutFn = vi.fn();
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(mockLogoutFn);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(mockLogoutFn).toHaveBeenCalledTimes(1);
  });

  it('estado loading: no muestra encabezado ni botón de cerrar sesión (regresión)', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(vi.fn());

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    expect(screen.getByText('Cargando proyectos...')).toBeInTheDocument();
  });

  it('estado error: no muestra encabezado ni botón de cerrar sesión, sigue con Reintentar (regresión)', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(vi.fn());

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByText('Error al cargar los proyectos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('estado redirigiendo: no muestra el botón de cerrar sesión (regresión)', () => {
    mockUseProjects.mockReturnValue({
      data: [{ id: 1, name: 'Proyecto Alpha' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseLogout.mockReturnValue(vi.fn());

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.getByText('Redirigiendo...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
  });

  it('auto-redirige al primer proyecto cuando hay múltiples proyectos', () => {
    mockUseProjects.mockReturnValue({
      data: [
        { id: 2, name: 'Proyecto Beta' },
        { id: 1, name: 'Proyecto Alpha' },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Redirigiendo...')).toBeInTheDocument();
    expect(mockPush).toHaveBeenCalledWith('/projects/1/requirements?view=list');
  });

  it('muestra spinner de redirección cuando hay un solo proyecto', async () => {
    mockUseProjects.mockReturnValue({
      data: [{ id: 1, name: 'Proyecto Alpha' }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Redirigiendo...')).toBeInTheDocument();
  });

  it('redirige automáticamente con proyectos ordenados alfabéticamente', () => {
    mockUseProjects.mockReturnValue({
      data: [
        { id: 3, name: 'Zebra Project' },
        { id: 1, name: 'Alpha Project' },
        { id: 2, name: 'Beta Project' },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ProjectsPage />
      </Wrapper>
    );

    expect(mockPush).toHaveBeenCalledWith('/projects/1/requirements?view=list');
  });
});
