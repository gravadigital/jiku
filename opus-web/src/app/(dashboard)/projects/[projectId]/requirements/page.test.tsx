import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RequirementsPage from './page';
import { useRequirementsByStatus } from '@/features/requirements/hooks/useRequirementsByStatus';
import { vi, type Mock } from 'vitest';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const navState = { view: 'list', isMobile: false };
const mockDocsSection = vi.fn();

vi.mock('@/features/docs', () => ({
  DocsSection: (props: { projectId: number }) => {
    mockDocsSection(props);
    return <section data-testid="docs-section" />;
  },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '1' }),
  useSearchParams: () => ({ get: () => navState.view }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { roles: ['external-user'] } } }),
}));

vi.mock('@/contexts/ProjectContext', () => ({
  useActiveProject: () => ({ activeProject: null, setActiveProject: vi.fn() }),
}));

vi.mock('@/features/projects', () => ({
  useProjects: () => ({ data: [] }),
}));

vi.mock('@/shared/hooks', () => ({
  useIsMobile: () => navState.isMobile,
}));

vi.mock('@/features/requirements/hooks/useRequirementsByStatus');

const mockUseRequirementsByStatus = useRequirementsByStatus as Mock;

describe('RequirementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navState.view = 'list';
    navState.isMobile = false;
    mockUseRequirementsByStatus.mockReturnValue({
      data: { pages: [[]] },
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      isLoading: false,
      error: null,
    });
  });

  it('invoca useRequirementsByStatus 7 veces, una por cada estado vigente', () => {
    render(<RequirementsPage />, { wrapper });
    expect(mockUseRequirementsByStatus).toHaveBeenCalledTimes(7);
    const calledStatuses = mockUseRequirementsByStatus.mock.calls.map((call) => call[0].status[0]);
    expect(calledStatuses).toEqual([
      'analisis',
      'planificacion',
      'en_cola',
      'desarrollo',
      'revision',
      'resuelto',
      'cancelado',
    ]);
  });

  describe('sección de documentos', () => {
    function headerEl() {
      // BoardHeader es el primer hijo del contenedor de la página.
      return screen.getByTestId('docs-section').previousElementSibling as Element;
    }

    it.each([
      { name: 'mobile', isMobile: true, view: 'list' },
      { name: 'desktop lista', isMobile: false, view: 'list' },
      { name: 'desktop kanban', isMobile: false, view: 'kanban' },
    ])('TS-43: aparece una vez, entre el header y la vista (%s)', ({ isMobile, view }) => {
      navState.isMobile = isMobile;
      navState.view = view;
      const { container } = render(<RequirementsPage />, { wrapper });
      expect(screen.getAllByTestId('docs-section')).toHaveLength(1);
      expect(mockDocsSection).toHaveBeenCalledWith({ projectId: 1 });
      const page = container.firstElementChild as Element;
      const children = Array.from(page.children);
      const index = children.indexOf(screen.getByTestId('docs-section'));
      expect(index).toBe(1);
      expect(headerEl()).toBe(children[0]);
    });

    it('TS-44: no suma una query al tablero', () => {
      render(<RequirementsPage />, { wrapper });
      expect(mockUseRequirementsByStatus).toHaveBeenCalledTimes(7);
      expect(screen.queryByText('Cargando requisitos...')).not.toBeInTheDocument();
    });

    it('TS-45: con el tablero cargando no se muestra la sección', () => {
      mockUseRequirementsByStatus.mockReturnValue({
        data: undefined,
        hasNextPage: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        isLoading: true,
        error: null,
      });
      render(<RequirementsPage />, { wrapper });
      expect(screen.getByText('Cargando requisitos...')).toBeInTheDocument();
      expect(screen.queryByTestId('docs-section')).not.toBeInTheDocument();
    });
  });
});
