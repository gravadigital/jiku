import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RequirementDetailModal } from './RequirementDetailModal';

const mockOnClose = vi.fn();
const mockRefetch = vi.fn();
const mockUseRequirement = vi.fn();
const navState = { isMobile: false };

vi.mock('../../hooks/useRequirement', () => ({
  useRequirement: (...args: unknown[]) => mockUseRequirement(...args),
}));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'u-1', roles: ['external-user'] } } }),
}));
vi.mock('@/shared/hooks', () => ({ useIsMobile: () => navState.isMobile }));

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

function hook(overrides: Record<string, unknown> = {}) {
  mockUseRequirement.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
}

function renderModal(isOpen = true) {
  return render(
    <RequirementDetailModal
      requirementId={345}
      isOpen={isOpen}
      onClose={mockOnClose}
      projectName="Proyecto Alpha"
    />
  );
}

function expectUnavailable() {
  expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
  expect(screen.getByText(BODY)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Reintentar/ })).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
}

function expectSystemError() {
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Error al cargar el requisito. Intentá de nuevo más tarde.'
  );
  expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: TITLE })).toBeNull();
}

describe('RequirementDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navState.isMobile = false;
  });

  it('TS-26: 404 muestra no disponible', () => {
    hook({ isError: true, error: NOT_FOUND_404 });
    renderModal();
    expectUnavailable();
  });

  it('TS-27: 403 muestra el mismo estado', () => {
    hook({ isError: true, error: FORBIDDEN_403 });
    renderModal();
    expectUnavailable();
  });

  it('TS-28: "Volver al tablero" cierra el modal', async () => {
    hook({ isError: true, error: NOT_FOUND_404 });
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /Volver al tablero/ }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('TS-29: sin error y sin datos muestra no disponible', () => {
    hook();
    renderModal();
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
  });

  it('TS-30: 5xx muestra error, Reintentar y Cerrar', () => {
    hook({ isError: true, error: INTERNAL_500 });
    renderModal();
    expectSystemError();
  });

  it('TS-31: Reintentar llama refetch y Cerrar llama onClose', async () => {
    hook({ isError: true, error: NETWORK });
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('TS-32: los estados de excepción no dependen del viewport', () => {
    navState.isMobile = true;
    hook({ isError: true, error: NOT_FOUND_404 });
    const first = renderModal();
    expectUnavailable();
    first.unmount();

    hook({ isError: true, error: INTERNAL_500 });
    renderModal();
    expectSystemError();
  });

  it('TS-33: click en el overlay cierra en los estados de excepción', async () => {
    hook({ isError: true, error: NOT_FOUND_404 });
    renderModal();
    await userEvent.click(screen.getByTestId('modal-overlay'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('TS-34: cerrado no renderiza', () => {
    hook({ isError: true, error: NOT_FOUND_404 });
    const { container } = renderModal(false);
    expect(container).toBeEmptyDOMElement();
  });
});
