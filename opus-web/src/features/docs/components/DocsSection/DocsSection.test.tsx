import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import { useModule } from '../../hooks/useModules';
import { useDocuments } from '../../hooks/useDocuments';
import { MSG_DOCS_FORBIDDEN } from '../../constants/docs.constants';
import { DocsSection } from './DocsSection';

vi.mock('../../hooks/useModules');
vi.mock('../../hooks/useDocuments');

const mockUseModule = useModule as Mock;
const mockUseDocuments = useDocuments as Mock;

const MSG = 'Los documentos no están disponibles en este momento. Probá de nuevo en unos minutos.';
const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';
const DOC_ITEM = {
  id: DOC_ID,
  title: 'Guía de despliegue',
  updatedAt: '2026-10-20T14:30:00.000Z',
};
const DOC_2 = {
  ...DOC_ITEM,
  id: '01JC7Z6C3M9E5G7H1J2K4M6N8P',
  title: 'Manual de usuario',
  updatedAt: '2026-10-02T09:00:00.000Z',
};

function docsResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      pages: [{ items: [DOC_ITEM, DOC_2], page: { limit: 5, returned: 2 } }],
    },
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  };
}

function available() {
  mockUseModule.mockReturnValue({ status: 'available', isKnown: true });
}

describe('DocsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocuments.mockReturnValue(docsResult());
  });

  it('TS-32: lista los documentos del proyecto', () => {
    available();
    render(<DocsSection projectId={12} />);
    expect(screen.getByRole('button', { name: /Documentación \(2\)/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('link', { name: 'Guía de despliegue' })).toHaveAttribute(
      'href',
      `/projects/12/docs/${DOC_ID}`
    );
    expect(screen.getByText('Actualizado el 20/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Actualizado el 02/10/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('TS-33: not_installed no renderiza y no consulta', () => {
    mockUseModule.mockReturnValue({ status: 'not_installed', isKnown: true });
    const { container } = render(<DocsSection projectId={12} />);
    expect(container).toBeEmptyDOMElement();
    expect(mockUseDocuments).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('TS-34: estado desconocido no renderiza', () => {
    mockUseModule.mockReturnValue({ status: 'not_installed', isKnown: false });
    const { container } = render(<DocsSection projectId={12} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('TS-35: 0 documentos no renderiza', () => {
    available();
    mockUseDocuments.mockReturnValue(
      docsResult({ data: { pages: [{ items: [], page: { limit: 5, returned: 0 } }] } })
    );
    const { container } = render(<DocsSection projectId={12} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('TS-36: módulo unavailable muestra el aviso sin contador ni filas', () => {
    mockUseModule.mockReturnValue({ status: 'unavailable', isKnown: true });
    render(<DocsSection projectId={12} />);
    expect(screen.getByText('Documentación')).toBeInTheDocument();
    expect(screen.getByText(MSG)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
    expect(mockUseDocuments).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it.each([
    { code: 'upstream_unavailable', message: 'core no responde', status: 503 },
    { code: 'gateway_timeout', message: 'x', status: 504 },
  ])('TS-37: error $code muestra el aviso, nunca vacío', (error) => {
    available();
    mockUseDocuments.mockReturnValue(docsResult({ data: undefined, isError: true, error }));
    render(<DocsSection projectId={12} />);
    expect(screen.getByText('Documentación')).toBeInTheDocument();
    expect(screen.getByText(MSG)).toBeInTheDocument();
  });

  it('TS-38: error module_not_installed no renderiza', () => {
    available();
    mockUseDocuments.mockReturnValue(
      docsResult({
        data: undefined,
        isError: true,
        error: { code: 'module_not_installed', message: 'x', status: 404 },
      })
    );
    const { container } = render(<DocsSection projectId={12} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('TS-39: cargando muestra spinner y título sin contador', () => {
    available();
    mockUseDocuments.mockReturnValue(docsResult({ data: undefined, isLoading: true }));
    render(<DocsSection projectId={12} />);
    expect(screen.getByText('Documentación')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('TS-40: Ver más y contador con +', async () => {
    available();
    const fetchNextPage = vi.fn();
    const five = Array.from({ length: 5 }, (_, i) => ({
      ...DOC_ITEM,
      id: `id${i}`,
      title: `Doc ${i}`,
    }));
    mockUseDocuments.mockReturnValue(
      docsResult({
        data: { pages: [{ items: five, page: { limit: 5, returned: 5, cursor: 'c2' } }] },
        hasNextPage: true,
        fetchNextPage,
      })
    );
    const { rerender } = render(<DocsSection projectId={12} />);
    expect(screen.getByRole('button', { name: /Documentación \(5\+\)/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    mockUseDocuments.mockReturnValue(
      docsResult({
        data: { pages: [{ items: five, page: { limit: 5, returned: 5, cursor: 'c2' } }] },
        hasNextPage: true,
        isFetchingNextPage: true,
        fetchNextPage,
      })
    );
    rerender(<DocsSection projectId={12} />);
    const more = screen.getByText('Ver más').closest('button') as HTMLElement;
    expect(more).toHaveAttribute('aria-busy', 'true');
    expect(more).toBeDisabled();
  });

  it('TS-41: colapsa y expande con click y teclado', async () => {
    available();
    render(<DocsSection projectId={12} />);
    const toggle = screen.getByRole('button', { name: /Documentación \(2\)/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('TS-42: por requisito filtra solo por requirementId', () => {
    available();
    render(<DocsSection requirementId={345} projectId={12} />);
    expect(mockUseDocuments).toHaveBeenCalledWith({ requirementId: 345, enabled: true });
    expect(screen.getByRole('link', { name: 'Guía de despliegue' })).toHaveAttribute(
      'href',
      `/projects/12/docs/${DOC_ID}`
    );
  });
});

describe('S-090 — sin acceso', () => {
  const FORBIDDEN = 'No tenés acceso a la documentación de este proyecto.';
  const forbidden = { code: 'access_denied', message: 'Access denied', status: 403 };

  beforeEach(() => {
    vi.clearAllMocks();
    available();
  });

  function failWith(error: unknown, extra: Record<string, unknown> = {}) {
    mockUseDocuments.mockReturnValue(
      docsResult({ data: undefined, isError: true, error, ...extra })
    );
  }

  it('TS-13: 403 access_denied muestra sin acceso', () => {
    failWith(forbidden);
    render(<DocsSection projectId={12} />);
    expect(screen.getByText('Documentación')).toBeInTheDocument();
    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument();
    expect(screen.queryByText(MSG)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(FORBIDDEN);
  });

  it('TS-14: 403 caller_not_authorized muestra sin acceso', () => {
    failWith({
      code: 'caller_not_authorized',
      message: 'El caller no está autorizado',
      status: 403,
    });
    render(<DocsSection projectId={12} />);
    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument();
    expect(screen.queryByText(MSG)).toBeNull();
  });

  it('TS-15: caller_not_authorized con status distinto de 403 muestra sin acceso', () => {
    failWith({
      code: 'caller_not_authorized',
      message: 'El caller no está autorizado',
      status: 500,
    });
    render(<DocsSection projectId={12} />);
    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument();
    expect(screen.queryByText(MSG)).toBeNull();
  });

  it('TS-16: 403 permission_denied muestra sin acceso', () => {
    failWith({ code: 'permission_denied', message: 'Sin permiso', status: 403 });
    render(<DocsSection projectId={12} />);
    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument();
  });

  it('TS-17: sin lista, sin "Ver más", sin "Probá de nuevo" ni botón de colapsar', () => {
    failWith(forbidden, { hasNextPage: true });
    render(<DocsSection projectId={12} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Probá de nuevo/)).toBeNull();
    expect(screen.queryByText(/Documentación \(/)).toBeNull();
  });

  it('TS-18: detalle de requisito muestra el mismo estado', () => {
    failWith(forbidden);
    render(<DocsSection projectId={12} requirementId={345} />);
    expect(mockUseDocuments).toHaveBeenCalledWith({ requirementId: 345, enabled: true });
    expect(screen.getByText(FORBIDDEN)).toBeInTheDocument();
  });

  it.each([
    {
      code: 'module_unavailable',
      message: 'El módulo docs no está disponible en este momento',
      status: 503,
    },
    { code: 'gateway_timeout', message: 'x', status: 504 },
    { code: 'unknown_error', message: 'Error desconocido', status: 500 },
  ])('TS-19: $code sigue en no disponible', (error) => {
    failWith(error);
    render(<DocsSection projectId={12} />);
    expect(screen.getByText('Documentación')).toBeInTheDocument();
    expect(screen.getByText(MSG)).toBeInTheDocument();
    expect(screen.queryByText(FORBIDDEN)).toBeNull();
  });

  it('TS-20: module_not_installed gana aunque llegue con otro status', () => {
    failWith({
      code: 'module_not_installed',
      message: 'El módulo docs no está instalado',
      status: 404,
    });
    const { container } = render(<DocsSection projectId={12} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(FORBIDDEN)).toBeNull();
  });

  it('TS-21: la constante tiene el texto exacto', () => {
    expect(MSG_DOCS_FORBIDDEN).toBe(FORBIDDEN);
  });
});
