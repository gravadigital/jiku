import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocumentVersions } from '../../hooks/useDocumentVersions';
import { useRestoreVersion } from '../../hooks/useRestoreVersion';
import { DOC, ID_A, versionsQuery } from './fixtures';
import { VersionHistoryPanel } from './VersionHistoryPanel';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let mockUser: { id: string; name: string; zitadelId: string | null } = {
  id: '7f3c2a10-0000-4000-8000-000000000001',
  name: 'Yo',
  zitadelId: 'sub-yo',
};
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => mockUser }));
vi.mock('../../hooks/useDocumentVersions', () => ({ useDocumentVersions: vi.fn() }));
vi.mock('../../hooks/useRestoreVersion', () => ({ useRestoreVersion: vi.fn() }));

const renderPanel = (doc = DOC, onClose = vi.fn(), viewingVersion: number | null = null) =>
  render(<VersionHistoryPanel open doc={doc} viewingVersion={viewingVersion} onClose={onClose} />);

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: '7f3c2a10-0000-4000-8000-000000000001', name: 'Yo', zitadelId: 'sub-yo' };
  vi.mocked(useDocumentVersions).mockReturnValue(versionsQuery() as never);
  vi.mocked(useRestoreVersion).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
});

describe('VersionHistoryPanel', () => {
  it('TS-27: autor propio "vos" por sub, el de otra persona con su nombre', () => {
    renderPanel();
    const [v6, v5] = within(screen.getByRole('dialog')).getAllByRole('listitem');
    expect(v5).toHaveTextContent('vos');
    expect(v6).toHaveTextContent('Ana Pérez');
    expect(v6).not.toHaveTextContent('vos');
  });

  it('TS-28: sin zitadelId nunca "vos", aunque el id coincida con el autor', () => {
    mockUser = { id: 'sub-yo', name: 'Yo', zitadelId: null };
    renderPanel();
    const [, v5] = within(screen.getByRole('dialog')).getAllByRole('listitem');
    expect(v5).toHaveTextContent('Yo Mismo');
    expect(v5).not.toHaveTextContent('vos');
  });

  it('TS-38: diálogo accesible, entradas con autor del servicio, marcas y pie', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog', { name: 'Historial de versiones' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Historial de versiones' })).toHaveFocus();

    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    const [v6, v5, v1] = items;
    expect(v6).toHaveTextContent('Versión 6');
    expect(v6).toHaveTextContent('Actual');
    expect(v6).toHaveTextContent('Ana Pérez');
    expect(v6).toHaveTextContent('24/10/2026 14:30');
    expect(v6).toHaveTextContent('Edición');
    expect(within(v6).queryByRole('button', { name: 'Ver' })).toBeNull();
    expect(within(v6).queryByRole('button', { name: 'Restaurar' })).toBeNull();
    expect(v5).toHaveTextContent('vos');
    expect(v5).toHaveTextContent('Restauración');
    expect(v5).toHaveTextContent('“cierre de sprint”');
    expect(
      within(v5).getByRole('group', { name: 'Protegida: no se borra al compactar el historial' })
    ).toBeInTheDocument();
    expect(v1).toHaveTextContent('—');
    expect(v1).toHaveTextContent('Creación');
    expect(dialog).toHaveTextContent('3 versiones intermedias compactadas.');
  });

  it('TS-39: sin pie sin compactadas y singular con una', () => {
    const { unmount } = renderPanel({ ...(DOC as object), prunedVersionsCount: 0 } as never);
    expect(screen.queryByText(/compactada/)).toBeNull();
    unmount();
    renderPanel({ ...(DOC as object), prunedVersionsCount: 1 } as never);
    expect(screen.getByText('1 versión intermedia compactada.')).toBeInTheDocument();
  });

  it('TS-40: "Ver versiones anteriores" solo con más páginas', () => {
    const fetchNextPage = vi.fn();
    vi.mocked(useDocumentVersions).mockReturnValue(
      versionsQuery({ hasNextPage: true, fetchNextPage }) as never
    );
    const { unmount } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Ver versiones anteriores' }));
    expect(fetchNextPage).toHaveBeenCalled();
    unmount();
    vi.mocked(useDocumentVersions).mockReturnValue(versionsQuery() as never);
    renderPanel();
    expect(screen.queryByRole('button', { name: 'Ver versiones anteriores' })).toBeNull();
  });

  it('TS-41: "Ver" navega a ?version y cierra el panel', () => {
    const onClose = vi.fn();
    renderPanel(DOC, onClose);
    const v5 = screen.getAllByRole('listitem')[1] as HTMLElement;
    fireEvent.click(within(v5).getByRole('button', { name: 'Ver' }));
    expect(push).toHaveBeenCalledWith(`/docs/${ID_A}?version=5`);
    expect(onClose).toHaveBeenCalled();
  });

  it('TS-46: carga, error y Escape', () => {
    vi.mocked(useDocumentVersions).mockReturnValue(
      versionsQuery({ isLoading: true, data: undefined }) as never
    );
    const { unmount } = renderPanel();
    expect(screen.getByText('Cargando versiones…')).toBeInTheDocument();
    unmount();
    vi.mocked(useDocumentVersions).mockReturnValue(
      versionsQuery({ isError: true, data: undefined }) as never
    );
    const onClose = vi.fn();
    renderPanel(DOC, onClose);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo cargar el historial. Intentá de nuevo.'
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('cerrar con el botón de solo icono', () => {
    const onClose = vi.fn();
    renderPanel(DOC, onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar historial' }));
    expect(onClose).toHaveBeenCalled();
  });
});
