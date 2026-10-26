import { fireEvent, render, screen, within } from '@testing-library/react';
import { toast } from 'react-toastify';
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
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 'sub-yo', name: 'Yo' }),
}));
vi.mock('../../hooks/useDocumentVersions', () => ({ useDocumentVersions: vi.fn() }));
vi.mock('../../hooks/useRestoreVersion', () => ({ useRestoreVersion: vi.fn() }));

const mutate = vi.fn();
type Options = { onSuccess?: (d: unknown) => void; onError?: (e: unknown) => void };

const renderPanel = (doc = DOC, onClose = vi.fn(), viewingVersion: number | null = null) =>
  render(<VersionHistoryPanel open doc={doc} viewingVersion={viewingVersion} onClose={onClose} />);

const restoreOf = (n: number) => {
  const index = n === 5 ? 1 : 2;
  const item = screen.getAllByRole('listitem')[index] as HTMLElement;
  return within(item).getByRole('button', { name: 'Restaurar' });
};

const confirmDialog = () => screen.getByRole('dialog', { name: /Restaurar la versión/ });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDocumentVersions).mockReturnValue(versionsQuery() as never);
  vi.mocked(useRestoreVersion).mockReturnValue({ mutate, isPending: false } as never);
});

describe('VersionHistoryPanel — restaurar', () => {
  it('TS-42: confirma, restaura con la base vigente, avisa y cierra', () => {
    mutate.mockImplementationOnce((_p: unknown, options: Options) =>
      options.onSuccess?.({ id: ID_A, version: 7 })
    );
    const onClose = vi.fn();
    renderPanel(DOC, onClose);
    fireEvent.click(restoreOf(5));
    const dialog = confirmDialog();
    expect(dialog).toHaveTextContent('Restaurar la versión 5');
    expect(dialog).toHaveTextContent(
      'Se va a guardar una versión nueva con el contenido de la versión 5. La versión actual no se pierde: queda en el historial.'
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(mutate.mock.calls[0]?.[0]).toEqual({ fromVersion: 5, baseVersion: 6 });
    expect(toast.success).toHaveBeenCalledWith('Restauraste la versión 5 como versión 7.');
    expect(onClose).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('TS-42: cancelar no restaura', () => {
    renderPanel();
    fireEvent.click(restoreOf(5));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Cancelar' }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('TS-43: viendo una versión, además vuelve a la lectura normal', () => {
    mutate.mockImplementationOnce((_p: unknown, options: Options) =>
      options.onSuccess?.({ id: ID_A, version: 7 })
    );
    renderPanel(DOC, vi.fn(), 5);
    fireEvent.click(restoreOf(5));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Restaurar' }));
    expect(replace).toHaveBeenCalledWith(`/docs/${ID_A}`);
  });

  it.each([
    [
      { code: 'version_conflict' },
      'El documento cambió mientras restaurabas; actualizamos el historial.',
    ],
    [{ code: 'version_pruned' }, 'La versión 5 ya no se conserva.'],
    [{ code: 'gateway_timeout' }, 'No se pudo restaurar la versión 5. Intentá de nuevo.'],
  ])('TS-44: %j muestra el aviso y el panel sigue abierto', (error, message) => {
    mutate.mockImplementationOnce((_p: unknown, options: Options) => options.onError?.(error));
    const onClose = vi.fn();
    renderPanel(DOC, onClose);
    fireEvent.click(restoreOf(5));
    fireEvent.click(within(confirmDialog()).getByRole('button', { name: 'Restaurar' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Historial de versiones' })).toBeInTheDocument();
  });

  it('TS-45: con reserva vigente de otra persona todos los Restaurar están deshabilitados', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T15:40:00Z'));
    renderPanel({
      ...(DOC as object),
      lock: {
        sessionId: 'S',
        holder: 'sub-luis',
        holderName: 'Luis Gómez',
        via: 'human',
        expiresAt: '2026-10-26T15:45:00.000Z',
      },
    } as never);
    for (const n of [5, 1]) {
      const button = restoreOf(n);
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription('Luis Gómez lo está editando.');
    }
    vi.useRealTimers();
  });

  it('TS-45: restaurando deshabilita la entrada en curso', () => {
    vi.mocked(useRestoreVersion).mockReturnValue({
      mutate,
      isPending: true,
      variables: { fromVersion: 5, baseVersion: 6 },
    } as never);
    renderPanel();
    expect(restoreOf(5)).toBeDisabled();
    expect(restoreOf(5)).toHaveAttribute('aria-busy', 'true');
    expect(restoreOf(1)).toBeEnabled();
  });
});
