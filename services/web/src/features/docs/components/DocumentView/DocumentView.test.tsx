import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePersons } from '@/features/auth/hooks/usePersons';
import { useClient } from '@/features/clients/hooks/useClient';
import { useObjective } from '@/features/objectives/hooks/useObjective';
import { useProject } from '@/features/projects/hooks/useProject';
import { useRequirement } from '@/features/requirements/hooks/useRequirement';
import { useDocument } from '../../hooks/useDocument';
import { useModule } from '../../hooks/useModules';
import { DocumentView } from './DocumentView';
import { DETAIL_A, ATT_ID, ID_A, UNAVAILABLE } from './fixtures';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));
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
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: '7f3c2a10-0000-4000-8000-000000000001', name: 'Yo', zitadelId: 'sub-yo' }),
}));
vi.mock('../VersionHistoryPanel', () => ({
  VersionHistoryPanel: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Historial de versiones" /> : null,
}));
// TS-23: la lectura ya no resuelve nombres con un hook por id ni con personas.
vi.mock('@/features/auth/hooks/usePersons', () => ({ usePersons: vi.fn() }));
vi.mock('@/features/clients/hooks/useClient', () => ({ useClient: vi.fn() }));
vi.mock('@/features/projects/hooks/useProject', () => ({ useProject: vi.fn() }));
vi.mock('@/features/requirements/hooks/useRequirement', () => ({ useRequirement: vi.fn() }));
vi.mock('@/features/objectives/hooks/useObjective', () => ({ useObjective: vi.fn() }));

const setModule = (status: 'not_installed' | 'unavailable' | 'available', sharing = false) =>
  vi.mocked(useModule).mockReturnValue({ status, sharing, isKnown: true });
const setDoc = (over: Record<string, unknown> = {}) =>
  vi.mocked(useDocument).mockReturnValue({
    data: { ...DETAIL_A, ...over },
    isLoading: false,
    isError: false,
  } as never);

describe('DocumentView — lectura sin ruta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setModule('available');
    setDoc();
  });

  it('TS-18: breadcrumb, título, visibilidad, línea, temas y meta; sin ruta ni Volver', () => {
    const { container } = render(<DocumentView id={ID_A} />);

    const route = screen.getByRole('navigation', { name: 'Ruta' });
    expect(within(route).getByRole('link', { name: 'Documentación' })).toHaveAttribute(
      'href',
      '/docs'
    );
    expect(within(route).getByText('Arquitectura de videoconferencia')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Arquitectura de videoconferencia' })
    ).toBeInTheDocument();
    expect(screen.getByText('Interno', { selector: 'span' })).toBeInTheDocument();

    const line = container.querySelector('p[class*="clientProject"]') as HTMLElement;
    expect(line).toHaveTextContent('EXO · Videoconferencia #12');
    // La línea apunta al proyecto; "Vinculado a" también lo enlaza.
    expect(within(line).getByRole('link', { name: 'Videoconferencia' })).toHaveAttribute(
      'href',
      '/projects/12'
    );
    expect(screen.getByRole('link', { name: 'video' })).toHaveAttribute('href', '/docs?tema=video');
    expect(screen.getByRole('link', { name: 'arquitectura' })).toHaveAttribute(
      'href',
      '/docs?tema=arquitectura'
    );
    expect(
      screen.getByText('Versión 6 · actualizado 24/10/2026 14:30 por Ana Pérez')
    ).toBeInTheDocument();

    expect(screen.queryByText('Ruta de almacenamiento')).toBeNull();
    expect(container).not.toHaveTextContent('/clientes/');
    expect(container).not.toHaveTextContent('arquitectura.md');
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull();
  });

  it('TS-19: el frontmatter no se muestra', () => {
    render(<DocumentView id={ID_A} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Contexto' })).toBeInTheDocument();
    expect(screen.queryByText(/title: Arquitectura/)).toBeNull();
    expect(screen.queryByText(/jiku:/)).toBeNull();
    expect(screen.queryByText('---')).toBeNull();
  });

  it('TS-21: índice "En este documento" con anclas; sin encabezados no hay índice', () => {
    const { container, rerender } = render(<DocumentView id={ID_A} />);
    const toc = screen.getByRole('navigation', { name: 'En este documento' });
    expect(within(toc).getByRole('link', { name: 'Contexto' })).toHaveAttribute(
      'href',
      '#contexto'
    );
    expect(within(toc).getByRole('link', { name: 'Decisiones' })).toHaveAttribute(
      'href',
      '#decisiones'
    );
    expect(container.querySelector('h2#contexto')).not.toBeNull();
    expect(container.querySelector('h3#decisiones')).not.toBeNull();

    setDoc({ content: 'Solo texto.' });
    rerender(<DocumentView id={ID_A} />);
    expect(screen.queryByRole('navigation', { name: 'En este documento' })).toBeNull();
  });

  it('TS-23: "Vinculado a" con los nombres de la api y sin hooks por id', () => {
    render(<DocumentView id={ID_A} />);
    const card = screen.getByRole('heading', { name: 'Vinculado a' }).parentElement as HTMLElement;
    expect(within(card).getByText('EXO')).toBeInTheDocument();
    expect(within(card).queryByRole('link', { name: 'EXO' })).toBeNull();
    expect(within(card).getByRole('link', { name: 'Login con SSO' })).toHaveAttribute(
      'href',
      '/requirements/151'
    );
    expect(within(card).getByRole('link', { name: 'Migrar video' })).toHaveAttribute(
      'href',
      '/objectives/7'
    );
    expect(useClient).not.toHaveBeenCalled();
    expect(useProject).not.toHaveBeenCalled();
    expect(useRequirement).not.toHaveBeenCalled();
    expect(useObjective).not.toHaveBeenCalled();
    expect(usePersons).not.toHaveBeenCalled();
  });

  it('TS-23: un proyecto que la api no conoce se muestra #id sin enlace', () => {
    setDoc({
      projectRefs: [{ id: 99, name: null, code: null, clientId: null }],
      requirementRefs: [],
      taskRefs: [],
      clientRefs: [],
    });
    render(<DocumentView id={ID_A} />);
    const card = screen.getByRole('heading', { name: 'Vinculado a' }).parentElement as HTMLElement;
    expect(within(card).getByText('#99')).toBeInTheDocument();
    expect(within(card).queryByRole('link')).toBeNull();
  });

  it('TS-24: sin vínculos', () => {
    setDoc({ clientRefs: [], projectRefs: [], requirementRefs: [], taskRefs: [] });
    render(<DocumentView id={ID_A} />);
    expect(
      screen.getByText(
        'Este documento no está vinculado a ningún cliente, proyecto, requisito ni tarea.'
      )
    ).toBeInTheDocument();
  });

  it('TS-25: propiedades sin ruta y adjuntos con cantidad', () => {
    const { rerender } = render(<DocumentView id={ID_A} />);
    const props = screen.getByRole('heading', { name: 'Propiedades' }).parentElement as HTMLElement;
    expect(within(props).getByText('Visibilidad').nextElementSibling).toHaveTextContent('Interno');
    expect(within(props).getByText('Versión').nextElementSibling).toHaveTextContent('6');
    expect(screen.queryByText(/Ruta/)).toBeNull();
    const attachment = screen.getByRole('link', { name: 'diagrama.png' });
    expect(screen.getByRole('heading', { name: 'Adjuntos (1)' })).toBeInTheDocument();
    expect(attachment).toHaveAttribute('href', `/docs/attachments/${ATT_ID}`);
    expect(attachment).toHaveAttribute('target', '_blank');

    setDoc({ attachments: [] });
    rerender(<DocumentView id={ID_A} />);
    expect(screen.getByRole('heading', { name: 'Adjuntos' })).toBeInTheDocument();
    expect(screen.getByText('Sin adjuntos.')).toBeInTheDocument();

    setDoc({ visibility: 'public' });
    rerender(<DocumentView id={ID_A} />);
    expect(screen.getAllByText('Visible para el cliente').length).toBeGreaterThanOrEqual(2);
  });

  it('TS-26: sin título, "Sin título" en el h1 y el breadcrumb', () => {
    setDoc({ title: '', clientRefs: [], projectRefs: [] });
    const { container } = render(<DocumentView id={ID_A} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sin título' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Ruta' })).getByText('Sin título')
    ).toBeInTheDocument();
    expect(container).toHaveTextContent('Sin cliente · Sin proyecto');
  });

  it('TS-27: autor sin nombre se omite y nunca aparece "otra persona"', () => {
    setDoc({ updatedByName: null, updatedBy: 'sub-x' });
    const { container } = render(<DocumentView id={ID_A} />);
    expect(screen.getByText('Versión 6 · actualizado 24/10/2026 14:30')).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain('otra persona');
  });

  it('TS-27: la persona actual aparece como "vos"', () => {
    setDoc({ updatedBy: 'sub-yo' });
    render(<DocumentView id={ID_A} />);
    expect(
      screen.getByText('Versión 6 · actualizado 24/10/2026 14:30 por vos')
    ).toBeInTheDocument();
  });

  it('TS-62: documento grande con contentUrl se renderiza', () => {
    setDoc({ content: '# Grande', contentUrl: 'https://s3.example.com/x' });
    render(<DocumentView id={ID_A} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Grande' })).toBeInTheDocument();
  });

  it('TS-57: módulo caído con documento ya cargado muestra aviso y contenido', () => {
    setModule('unavailable');
    render(<DocumentView id={ID_A} />);
    expect(screen.getByRole('alert')).toHaveTextContent(UNAVAILABLE);
    expect(screen.getByRole('heading', { level: 2, name: 'Contexto' })).toBeInTheDocument();
  });

  it('TS-33: botón Historial con nombre accesible; deshabilitado con el módulo caído', () => {
    const { unmount } = render(<DocumentView id={ID_A} />);
    expect(screen.getByRole('button', { name: 'Historial de versiones' })).toBeEnabled();
    unmount();
    setModule('unavailable');
    render(<DocumentView id={ID_A} />);
    expect(screen.getByRole('button', { name: 'Historial de versiones' })).toBeDisabled();
  });

  it('el orden de foco: breadcrumb → línea y temas → botones → contenido → índice', () => {
    render(<DocumentView id={ID_A} />);
    const before = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const crumb = screen.getByRole('navigation', { name: 'Ruta' });
    const topic = screen.getByRole('link', { name: 'video' });
    const history = screen.getByRole('button', { name: 'Historial de versiones' });
    const edit = screen.getByRole('button', { name: /Editar/ });
    const content = screen.getByRole('heading', { level: 2, name: 'Contexto' });
    const toc = screen.getByRole('navigation', { name: 'En este documento' });
    expect(before(crumb, topic)).toBe(true);
    expect(before(topic, history)).toBe(true);
    expect(before(history, edit)).toBe(true);
    expect(before(edit, content)).toBe(true);
    expect(before(content, toc)).toBe(true);
  });
});
