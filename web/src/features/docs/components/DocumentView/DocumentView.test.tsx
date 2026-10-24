import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClient } from '@/features/clients/hooks/useClient';
import { useObjective } from '@/features/objectives/hooks/useObjective';
import { useProject } from '@/features/projects/hooks/useProject';
import { useRequirement } from '@/features/requirements/hooks/useRequirement';
import { useDocument } from '../../hooks/useDocument';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));
vi.mock('../../hooks/useFolderTrail', () => ({ useFolderTrail: () => ({ data: undefined }) }));
vi.mock('../../hooks/useEditSession', () => ({
  useEditSession: () => ({
    phase: 'idle',
    sessionId: null,
    blockedBy: null,
    start: vi.fn(),
    release: vi.fn(),
    markBlocked: vi.fn(),
    clearBlocked: vi.fn(),
  }),
}));
vi.mock('../../hooks/useDocument', () => ({ useDocument: vi.fn() }));
vi.mock('../../hooks/useModules', () => ({ useModule: vi.fn() }));
vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({
    data: [{ userId: 'sub-ana', firstName: 'Ana', lastName: 'Gómez' }],
  })),
}));
vi.mock('@/features/clients/hooks/useClient', () => ({ useClient: vi.fn() }));
vi.mock('@/features/projects/hooks/useProject', () => ({ useProject: vi.fn() }));
vi.mock('@/features/requirements/hooks/useRequirement', () => ({ useRequirement: vi.fn() }));
vi.mock('@/features/objectives/hooks/useObjective', () => ({ useObjective: vi.fn() }));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const FOLDER_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';
const ATT_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6D1';
const UNAVAILABLE =
  'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.';

const DOC = {
  id: ID,
  title: 'Arquitectura',
  path: '/clientes/acme/arquitectura.md',
  folderId: FOLDER_ID,
  fileName: 'arquitectura.md',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  lock: null,
  content: '# Intro\n\nTexto',
  relations: { clients: [3], projects: [12], requirements: [45], tasks: [7] },
  topics: ['infra', 'auth'],
  attachments: [
    {
      id: ATT_ID,
      documentId: ID,
      fileName: 'diagrama.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      link: `https://jiku.example.com/docs/attachments/${ATT_ID}`,
      uploadedBy: 'sub-ana',
      createdAt: '2026-10-20T10:00:00.000Z',
    },
  ],
  folder: {
    id: FOLDER_ID,
    path: '/clientes/acme/',
    effectivePermission: 'read',
    sharingBlocked: false,
  },
};

const setModule = (status: 'not_installed' | 'unavailable' | 'available', isKnown = true) =>
  vi.mocked(useModule).mockReturnValue({ status, sharing: false, isKnown });
const setDoc = (value: Record<string, unknown>) =>
  vi.mocked(useDocument).mockReturnValue(value as never);

describe('DocumentView — default', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModule('available');
    setDoc({ data: DOC, isLoading: false, isError: false });
    vi.mocked(useClient).mockReturnValue({ data: { name: 'ACME' } } as never);
    vi.mocked(useProject).mockReturnValue({ data: { name: 'Portal ACME' } } as never);
    vi.mocked(useRequirement).mockReturnValue({ data: { title: 'Login SSO' } } as never);
    vi.mocked(useObjective).mockReturnValue({ data: { title: 'Configurar IdP' } } as never);
  });

  it('TS-50: estado default', () => {
    render(<DocumentView id={ID} />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Arquitectura' })).toBeInTheDocument();
    expect(screen.getByText('Interno')).toBeInTheDocument();
    expect(
      screen.getByText('Versión 6 · actualizado el 24/10/2026 14:30 por Ana Gómez')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Intro' })).toBeInTheDocument();

    const relations = screen
      .getByRole('heading', { name: 'Vinculado a' })
      .closest('section, div')!.parentElement!;
    expect(within(relations).getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ACME' })).toHaveAttribute('href', '/clients/edit/3');
    expect(screen.getByRole('link', { name: 'Portal ACME' })).toHaveAttribute(
      'href',
      '/projects/12'
    );
    expect(screen.getByRole('link', { name: 'Login SSO' })).toHaveAttribute(
      'href',
      '/requirements/45'
    );
    expect(screen.getByRole('link', { name: 'Configurar IdP' })).toHaveAttribute(
      'href',
      '/objectives/7'
    );
    expect(screen.getByRole('heading', { name: 'Temas' })).toBeInTheDocument();
    expect(screen.getByText('infra')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();

    const attachment = screen.getByRole('link', { name: 'diagrama.png' });
    expect(attachment).toHaveAttribute('href', `/docs/attachments/${ATT_ID}`);
    expect(attachment).toHaveAttribute('target', '_blank');
  });

  it('TS-51: documento público', () => {
    setDoc({ data: { ...DOC, visibility: 'public' }, isLoading: false, isError: false });
    render(<DocumentView id={ID} />);
    expect(screen.getByText('Visible para el cliente')).toBeInTheDocument();
  });

  it('TS-52: sin vínculos, temas ni adjuntos', () => {
    setDoc({
      data: { ...DOC, relations: {}, topics: [], attachments: [] },
      isLoading: false,
      isError: false,
    });
    render(<DocumentView id={ID} />);
    expect(
      screen.getByText('Este documento no está vinculado a ningún proyecto, requisito ni tarea.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Temas' })).toBeNull();
    expect(screen.getByText('Sin adjuntos.')).toBeInTheDocument();
  });

  it('TS-53: nombre de vínculo que no carga', () => {
    vi.mocked(useProject).mockReturnValue({ isError: true, data: undefined } as never);
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('link', { name: 'Proyecto #12' })).toHaveAttribute(
      'href',
      '/projects/12'
    );
  });

  it('TS-54: autor desconocido', () => {
    setDoc({ data: { ...DOC, updatedBy: 'sub-desconocido' }, isLoading: false, isError: false });
    render(<DocumentView id={ID} />);
    expect(screen.getByText(/por otra persona$/)).toBeInTheDocument();
  });

  it('TS-60: Volver navega a la carpeta del documento', () => {
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Ruta' })).toBeInTheDocument();
  });

  it('TS-62: documento grande con contentUrl se renderiza', () => {
    setDoc({
      data: { ...DOC, content: '# Grande', contentUrl: 'https://s3.example.com/x' },
      isLoading: false,
      isError: false,
    });
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Grande' })).toBeInTheDocument();
  });

  it('TS-57: módulo caído con documento ya cargado muestra aviso y contenido', () => {
    setModule('unavailable');
    render(<DocumentView id={ID} />);
    expect(screen.getByRole('alert')).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('heading', { level: 2, name: 'Intro' })).toBeInTheDocument();
  });

  it('el orden de foco empieza por Volver', () => {
    render(<DocumentView id={ID} />);
    const back = screen.getByRole('button', { name: 'Volver' });
    const breadcrumb = screen.getByRole('navigation', { name: 'Ruta' });
    const content = screen.getByRole('heading', { level: 2, name: 'Intro' });
    expect(
      back.compareDocumentPosition(breadcrumb) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(back.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
