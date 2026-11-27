import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import RequirementDetailPage from './page';

const mockPush = vi.fn();
const mockRefetch = vi.fn();
const mockUseRequirement = vi.fn();
const navState = { requirementId: '345' };

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '12', requirementId: navState.requirementId }),
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => ({ get: () => 'list' }),
}));
vi.mock('@/features/requirements', () => ({
  useRequirement: (...args: unknown[]) => mockUseRequirement(...args),
}));
vi.mock('@/features/projects', () => ({
  useProjects: () => ({ data: [{ id: 12, name: 'Proyecto Alpha' }] }),
}));
vi.mock('@/features/requirements/components/RequirementDetailView', () => ({
  RequirementDetailView: () => <div data-testid="detail-view" />,
}));
vi.mock('@/features/subscriptions/hooks/useSubscribe', () => ({
  useSubscribe: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/subscriptions/hooks/useUnsubscribe', () => ({
  useUnsubscribe: () => ({ mutate: vi.fn(), isPending: false }),
}));

const TITLE = 'El requisito no está disponible o no tenés acceso';
const BODY =
  'Puede que no exista o que no tengas permiso para verlo. Si te compartieron este enlace, pedile acceso a tu contacto en el equipo.';
const NOT_FOUND_404 = {
  code: 'requirement_not_found',
  message: 'Requirement not found',
  status: 404,
};
const FORBIDDEN_403 = { code: 'access_denied', message: 'Access denied', status: 403 };
const INTERNAL_500 = { code: 'internal_error', message: 'Internal error', status: 500 };
const NETWORK = { code: 'unknown_error', message: 'Error desconocido', status: 500 };
const BOARD = '/projects/12/requirements';

function hook(overrides: Record<string, unknown> = {}) {
  mockUseRequirement.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
}

function expectUnavailable() {
  expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Volver al listado/ })).toBeNull();
}

describe('RequirementDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navState.requirementId = '345';
  });

  it('TS-18: 404 muestra no disponible con cabecera mínima', () => {
    hook({ error: NOT_FOUND_404 });
    render(<RequirementDetailPage />);
    expectUnavailable();
    expect(screen.getByText(BODY)).toBeInTheDocument();
    expect(screen.getByText('Proyecto Alpha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Requisitos' })).toBeInTheDocument();
    expect(screen.queryByText('#345')).toBeNull();
    expect(screen.queryByText('Error al cargar el requisito')).toBeNull();
  });

  it('TS-19: 403 muestra el mismo estado', () => {
    hook({ error: FORBIDDEN_403 });
    render(<RequirementDetailPage />);
    expectUnavailable();
  });

  it('TS-20: "Volver al tablero" navega', async () => {
    hook({ error: NOT_FOUND_404 });
    render(<RequirementDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /Volver al tablero/ }));
    expect(mockPush).toHaveBeenCalledWith(BOARD);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('TS-21: query resuelta sin datos muestra no disponible', () => {
    hook();
    render(<RequirementDetailPage />);
    expectUnavailable();
    expect(screen.queryByText('Requisito no encontrado')).toBeNull();
  });

  it('TS-22: id no numérico muestra no disponible', () => {
    navState.requirementId = 'abc';
    hook();
    render(<RequirementDetailPage />);
    expectUnavailable();
  });

  it('TS-23: 5xx conserva el error de sistema', () => {
    hook({ error: INTERNAL_500 });
    render(<RequirementDetailPage />);
    expect(screen.getByText('Error al cargar el requisito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver al listado/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull();
  });

  it('TS-24: red muestra error de sistema; Reintentar llama refetch', async () => {
    hook({ error: NETWORK });
    render(<RequirementDetailPage />);
    await userEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: /Volver al listado/ }));
    expect(mockPush).toHaveBeenCalledWith(BOARD);
  });

  it('TS-25: loading y default sin cambios', () => {
    hook({ isLoading: true });
    const { unmount } = render(<RequirementDetailPage />);
    expect(screen.getByText('Cargando requisito...')).toBeInTheDocument();
    expect(screen.queryByText(TITLE)).toBeNull();
    unmount();

    hook({ data: { id: 345, projectId: 12, project: { name: 'Proyecto Alpha' } } });
    render(<RequirementDetailPage />);
    expect(screen.getByTestId('detail-view')).toBeInTheDocument();
    expect(screen.queryByText(TITLE)).toBeNull();
  });
});
