import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RequirementsPage from './page';
import { useRequirementsByStatus } from '@/features/requirements/hooks/useRequirementsByStatus';
import { vi, type Mock } from 'vitest';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '1' }),
  useSearchParams: () => ({ get: () => 'list' }),
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
  useIsMobile: () => false,
}));

vi.mock('@/features/requirements/hooks/useRequirementsByStatus');

const mockUseRequirementsByStatus = useRequirementsByStatus as Mock;

describe('RequirementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
