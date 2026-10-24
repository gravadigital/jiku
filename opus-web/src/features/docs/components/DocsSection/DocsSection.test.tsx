import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import { useModule } from '../../hooks/useModules';
import { useDocuments } from '../../hooks/useDocuments';
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
