import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDocumentShares } from '../../hooks/useDocumentShares';
import { useRevokeShare } from '../../hooks/useRevokeShare';
import { ShareLinksTable } from './ShareLinksTable';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../hooks/useDocumentShares', () => ({ useDocumentShares: vi.fn() }));
vi.mock('../../hooks/useRevokeShare', () => ({ useRevokeShare: vi.fn() }));

const DOC = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const SHARE_ACTIVE = {
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6S1',
  documentId: DOC,
  mode: 'latest',
  version: null,
  includeAttachments: true,
  note: 'para soporte ACME',
  status: 'active',
  createdBy: 'sub-ana',
  createdAt: '2026-10-24T12:00:00.000Z',
  expiresAt: '2026-11-08T12:00:00.000Z',
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  accessCount: 3,
  lastAccessAt: '2026-10-25T09:30:00.000Z',
};
const SHARE_REVOKED = {
  ...SHARE_ACTIVE,
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6S2',
  includeAttachments: false,
  note: null,
  status: 'revoked',
  expiresAt: '2026-11-19T10:00:00.000Z',
  revokedAt: '2026-10-21T08:00:00.000Z',
  accessCount: 0,
  lastAccessAt: null,
};
const SHARE_EXPIRED = {
  ...SHARE_REVOKED,
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6S3',
  status: 'expired',
  note: 'auditoría',
  revokedAt: null,
  expiresAt: '2026-10-22T10:00:00.000Z',
  accessCount: 12,
  lastAccessAt: '2026-10-21T17:45:00.000Z',
};

const mutate = vi.fn();
const sharesState = (over: Record<string, unknown> = {}) =>
  vi.mocked(useDocumentShares).mockReturnValue({
    data: {
      items: [SHARE_ACTIVE, SHARE_REVOKED, SHARE_EXPIRED],
      page: { limit: 200, returned: 3 },
    },
    isLoading: false,
    isError: false,
    ...over,
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRevokeShare).mockReturnValue({ mutate, isPending: false } as never);
  sharesState();
});

describe('ShareLinksTable', () => {
  it('TS-32: columnas y celdas, sin token', () => {
    const { container } = render(<ShareLinksTable documentId={DOC} />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Links de este documento' })
    ).toBeVisible();
    ['Estado', 'Vence', 'Nota', 'Accesos', 'Último acceso', 'Acción'].forEach((name) =>
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const first = within(rows[0]);
    ['Activo', '08/11/2026 12:00', 'para soporte ACME', '3', '25/10/2026 09:30'].forEach((t) =>
      expect(first.getByText(t)).toBeInTheDocument()
    );
    expect(first.getByRole('button', { name: 'Revocar' })).toBeInTheDocument();
    const second = within(rows[1]);
    ['Revocado', '19/11/2026 10:00', '—', '0', 'Nunca'].forEach((t) =>
      expect(second.getByText(t)).toBeInTheDocument()
    );
    expect(second.queryByRole('button')).toBeNull();
    const third = within(rows[2]);
    ['Vencido', '22/10/2026 10:00', 'auditoría', '12', '21/10/2026 17:45'].forEach((t) =>
      expect(third.getByText(t)).toBeInTheDocument()
    );
    expect(third.queryByRole('button')).toBeNull();
    expect(container.innerHTML).not.toContain('jds_');
    expect(container.innerHTML).not.toContain('/p/docs/');
  });

  it('TS-33: "Revocar" distinguible por su descripción', () => {
    render(<ShareLinksTable documentId={DOC} />);
    const button = screen.getByRole('button', { name: 'Revocar' });
    expect(button).toHaveAccessibleDescription(
      'Link que vence el 08/11/2026 12:00 · para soporte ACME'
    );
  });

  it('TS-34: sin links', () => {
    sharesState({ data: { items: [], page: { limit: 200, returned: 0 } } });
    render(<ShareLinksTable documentId={DOC} />);
    expect(screen.getByText('Este documento todavía no tiene links.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('TS-35: cargando y error', () => {
    sharesState({ data: undefined, isLoading: true });
    const { unmount } = render(<ShareLinksTable documentId={DOC} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    unmount();
    sharesState({ data: undefined, isError: true });
    render(<ShareLinksTable documentId={DOC} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los links.');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('TS-36: revocar con O-02', () => {
    mutate.mockImplementation((_id, options) => options.onSuccess());
    const { rerender } = render(<ShareLinksTable documentId={DOC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    const dialog = screen.getByRole('dialog', { name: 'Revocar link' });
    expect(dialog).toHaveTextContent(
      'Quien tenga este link va a dejar de poder abrir el documento. No se puede deshacer.'
    );
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revocar' }));
    expect(mutate).toHaveBeenCalledWith(SHARE_ACTIVE.id, expect.any(Object));
    expect(screen.queryByRole('dialog', { name: 'Revocar link' })).toBeNull();
    // El hook actualiza la fila: el foco va a su celda de estado.
    sharesState({
      data: {
        items: [{ ...SHARE_ACTIVE, status: 'revoked' }, SHARE_REVOKED, SHARE_EXPIRED],
        page: { limit: 200, returned: 3 },
      },
    });
    rerender(<ShareLinksTable documentId={DOC} />);
    expect(screen.getAllByText('Revocado')[0].closest('[tabindex="-1"]')).toBe(
      document.activeElement
    );
  });

  it('TS-37: cancelar no revoca', () => {
    render(<ShareLinksTable documentId={DOC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Revocar link' })).toBeNull();
  });

  it('P-11: el diálogo de revocación no es descendiente del contenedor de la tabla', () => {
    const { container } = render(<ShareLinksTable documentId={DOC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    const dialog = screen.getByRole('dialog', { name: 'Revocar link' });
    expect(container.contains(dialog)).toBe(false);
  });

  it('TS-38: error al revocar', () => {
    mutate.mockImplementation((_id, options) =>
      options.onError({ code: 'gateway_timeout', message: 'x', status: 504 })
    );
    const { unmount } = render(<ShareLinksTable documentId={DOC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    act(() => {
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Revocar link' })).getByRole('button', {
          name: 'Revocar',
        })
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo revocar el link. Intentá de nuevo.'
    );
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Revocar link' })).toBeNull();
    unmount();

    mutate.mockImplementation((_id, options) =>
      options.onError({ code: 'share_not_found', message: 'x', status: 404 })
    );
    render(<ShareLinksTable documentId={DOC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Revocar link' })).getByRole('button', {
        name: 'Revocar',
      })
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ShareLinksTable revocado por restringir (TS-49)', () => {
  it('muestra "Revocado (restringido)" y no ofrece revocar', () => {
    vi.mocked(useDocumentShares).mockReturnValue({
      data: {
        items: [
          { ...SHARE_REVOKED, id: 'A', revokeReason: 'restricted' },
          { ...SHARE_REVOKED, id: 'B', revokeReason: 'manual' },
        ],
        page: { limit: 200, returned: 2 },
      },
      isLoading: false,
      isError: false,
    } as never);
    render(<ShareLinksTable documentId="01J9Z3K8M2Q4R6T8V0W2Y4A6C8" enabled />);
    expect(screen.getByText('Revocado (restringido)')).toBeInTheDocument();
    expect(screen.getByText('Revocado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revocar' })).toBeNull();
  });
});
