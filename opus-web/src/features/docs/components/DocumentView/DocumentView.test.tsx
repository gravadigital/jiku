import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type Mock } from 'vitest';
import { useProjects } from '@/features/projects';
import { useDocument } from '../../hooks/useDocument';
import { useModule, useModules } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';

vi.mock('../../hooks/useModules');
vi.mock('../../hooks/useDocument');
vi.mock('@/features/projects', () => ({ useProjects: vi.fn() }));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const mockUseModules = useModules as Mock;
const mockUseModule = useModule as Mock;
const mockUseDocument = useDocument as Mock;

const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';
const ATT_ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';
const MSG = 'Los documentos no están disponibles en este momento. Probá de nuevo en unos minutos.';
const NOT_FOUND = 'Este documento no existe o no está compartido con vos.';
const DOC_DETAIL = {
  id: DOC_ID,
  title: 'Guía de despliegue',
  visibility: 'public',
  version: 3,
  updatedBy: 'sub-123',
  updatedAt: '2026-10-20T14:30:00.000Z',
  content: `---\nprojects: [12]\nvisibility: public\n---\n# Instalación\n\nPaso uno.\n\n![Diagrama](/docs/attachments/${ATT_ID})\n`,
  attachments: [{ id: ATT_ID, fileName: 'diagrama.png' }],
};

const refetchModules = vi.fn();
const refetchDocument = vi.fn();

function setModule(status: string, isKnown = true) {
  mockUseModule.mockReturnValue({ status, isKnown });
}
function setDocument(overrides: Record<string, unknown> = {}) {
  mockUseDocument.mockReturnValue({
    data: DOC_DETAIL,
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchDocument,
    ...overrides,
  });
}
function renderView() {
  return render(<DocumentView projectId={12} documentId={DOC_ID} />);
}

describe('DocumentView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseModules.mockReturnValue({ isLoading: false, isError: false, refetch: refetchModules });
    (useProjects as Mock).mockReturnValue({ data: [{ id: 12, name: 'Proyecto Acme' }] });
    setModule('available');
    setDocument();
  });

  it('TS-47: documento público, sin autor ni versión ni frontmatter', () => {
    renderView();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Guía de despliegue' })
    ).toBeInTheDocument();
    expect(screen.getByText('Actualizado el 20/10/2026')).toBeInTheDocument();
    expect(screen.queryByText('sub-123')).not.toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.queryByText(/visibility: public/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Instalación' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Diagrama' })).toHaveAttribute(
      'src',
      `/api/docs/attachments/${ATT_ID}`
    );
  });

  it('TS-48/49: breadcrumb, Volver y adjuntos', async () => {
    renderView();
    const nav = screen.getByRole('navigation', { name: 'Ubicación' });
    expect(nav).toHaveTextContent('Proyecto Acme');
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(push).toHaveBeenCalledWith('/projects/12/requirements');
    expect(screen.getByRole('heading', { level: 3, name: 'Adjuntos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'diagrama.png' })).toHaveAttribute(
      'href',
      `/api/docs/attachments/${ATT_ID}`
    );
  });

  it('TS-50: sin adjuntos no hay sección', () => {
    setDocument({ data: { ...DOC_DETAIL, attachments: [] } });
    renderView();
    expect(screen.queryByRole('heading', { name: 'Adjuntos' })).not.toBeInTheDocument();
    setDocument({ data: { ...DOC_DETAIL, attachments: undefined } });
    renderView();
    expect(screen.queryByRole('heading', { name: 'Adjuntos' })).not.toBeInTheDocument();
  });

  it('TS-51: cargando', () => {
    mockUseModules.mockReturnValue({ isLoading: true, isError: false, refetch: refetchModules });
    setModule('not_installed', false);
    renderView();
    expect(screen.getByText('Cargando documento...')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();

    setModule('available');
    mockUseModules.mockReturnValue({ isLoading: false, isError: false, refetch: refetchModules });
    setDocument({ data: undefined, isLoading: true });
    renderView();
    expect(screen.getAllByText('Cargando documento...')).toHaveLength(2);
  });

  it('TS-52: 404 document_not_found', () => {
    setDocument({
      data: undefined,
      isError: true,
      error: { code: 'document_not_found', message: 'x', status: 404 },
    });
    renderView();
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_FOUND);
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('TS-53: not_installed, module_not_installed y 403 son not found', () => {
    setModule('not_installed');
    renderView();
    expect(screen.getByRole('alert')).toHaveTextContent(NOT_FOUND);
    expect(mockUseDocument).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));

    for (const error of [
      { code: 'module_not_installed', message: 'x', status: 404 },
      { code: 'access_denied', message: 'x', status: 403 },
    ]) {
      setModule('available');
      setDocument({ data: undefined, isError: true, error });
      const { unmount } = renderView();
      expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent(NOT_FOUND);
      unmount();
    }
  });

  it('TS-54: módulo no disponible', () => {
    setModule('unavailable');
    const { unmount } = renderView();
    expect(screen.getByText(MSG)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    unmount();

    setModule('available');
    setDocument({
      data: undefined,
      isError: true,
      error: { code: 'module_unavailable', message: 'x', status: 503 },
    });
    renderView();
    expect(screen.getByText(MSG)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it.each([
    { code: 'gateway_timeout', message: 'x', status: 504 },
    { code: 'content_unavailable', message: 'x', status: 502 },
    { code: 'unknown_error', message: 'x', status: 500 },
  ])('TS-55: error de sistema ($code)', (error) => {
    setDocument({ data: undefined, isError: true, error });
    renderView();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el documento.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('TS-55: fallo al pedir los módulos es error de sistema', () => {
    mockUseModules.mockReturnValue({ isLoading: false, isError: true, refetch: refetchModules });
    setModule('not_installed', false);
    renderView();
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el documento.');
  });

  it('TS-56: Reintentar refetchea documento y módulos', async () => {
    setDocument({
      data: undefined,
      isError: true,
      error: { code: 'unknown_error', message: 'x', status: 500 },
    });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetchDocument).toHaveBeenCalledTimes(1);
    expect(refetchModules).toHaveBeenCalledTimes(1);
  });

  it('TS-57: el layout se resuelve por CSS (8fr 4fr, sin useIsMobile)', () => {
    const dir = __dirname;
    const scss = readFileSync(join(dir, 'DocumentView.module.scss'), 'utf8');
    expect(scss).toMatch(/grid-template-columns:\s*8fr 4fr/);
    expect(scss).toMatch(/max-width:\s*var\(--layout-reading-width\)/);
    expect(scss).toMatch(/@include mobile\s*\{\s*grid-template-columns:\s*1fr/);
    const tsx = readFileSync(join(dir, 'DocumentView.tsx'), 'utf8');
    expect(tsx).not.toContain('useIsMobile');
  });
});
