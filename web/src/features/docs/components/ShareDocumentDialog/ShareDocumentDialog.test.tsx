import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCreateShare } from '../../hooks/useCreateShare';
import { useDocumentShares } from '../../hooks/useDocumentShares';
import { useRevokeShare } from '../../hooks/useRevokeShare';
import { ShareDocumentDialog } from './ShareDocumentDialog';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../hooks/useCreateShare', () => ({ useCreateShare: vi.fn() }));
vi.mock('../../hooks/useDocumentShares', () => ({ useDocumentShares: vi.fn() }));
vi.mock('../../hooks/useRevokeShare', () => ({ useRevokeShare: vi.fn() }));

const DOC_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const FOLDER_ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6F0';
const URL_ =
  'https://docs-publico.ejemplo.com/p/docs/jds_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde';
const CREATED = {
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6S1',
  token: 'jds_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCde',
  url: URL_,
  expiresAt: '2026-11-08T12:00:00.000Z',
};
const DOC = {
  id: DOC_ID,
  title: 'Arquitectura',
  path: '/clientes/acme/arquitectura.md',
  folderId: FOLDER_ID,
  fileName: 'arquitectura.md',
  version: 6,
  visibility: 'internal',
  updatedAt: '2026-10-24T11:30:00.000Z',
  updatedBy: 'sub-ana',
  content: '# Arquitectura\n\nTexto',
  relations: {},
  topics: [],
  attachments: [],
  lock: null,
  folder: {
    id: FOLDER_ID,
    path: '/clientes/acme/',
    effectivePermission: 'manage',
    sharingBlocked: false,
  },
} as never;
const SHARE_ACTIVE = {
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6S1',
  documentId: DOC_ID,
  mode: 'latest',
  status: 'active',
  note: 'para soporte ACME',
  createdBy: 'sub-ana',
  createdAt: '2026-10-24T12:00:00.000Z',
  expiresAt: '2026-11-08T12:00:00.000Z',
  accessCount: 3,
  lastAccessAt: null,
};

type Options = { onSuccess?: (d: unknown) => void; onError?: (e: unknown) => void };
const mutate = vi.fn();
const reset = vi.fn();
const createState = (over: Record<string, unknown> = {}) =>
  vi.mocked(useCreateShare).mockReturnValue({
    mutate,
    reset,
    isPending: false,
    ...over,
  } as never);

const rejectWith = (code: string, status = 400) =>
  mutate.mockImplementationOnce((_input: unknown, options: Options) =>
    options.onError?.({ code, message: 'x', status })
  );
const resolveWith = () =>
  mutate.mockImplementationOnce((_input: unknown, options: Options) =>
    options.onSuccess?.(CREATED)
  );

const setup = (doc = DOC, onClose = vi.fn()) => {
  const view = render(<ShareDocumentDialog open doc={doc} onClose={onClose} />);
  return { onClose, ...view };
};
const dialogOf = () => screen.getByRole('dialog', { name: 'Compartir «Arquitectura»' });

beforeEach(() => {
  vi.clearAllMocks();
  createState();
  vi.mocked(useDocumentShares).mockReturnValue({
    data: { items: [SHARE_ACTIVE], page: { limit: 200, returned: 1 } },
    isLoading: false,
    isError: false,
  } as never);
  vi.mocked(useRevokeShare).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
});

describe('ShareDocumentDialog', () => {
  it('TS-19: abre en default con los valores por defecto', () => {
    setup();
    const dialog = dialogOf();
    expect(dialog).toHaveTextContent(
      'Cualquiera que tenga el link va a poder leer la última versión del documento, sin iniciar sesión, hasta que venza o lo revoques.'
    );
    const expiry = within(dialog).getByRole('combobox', { name: /Vence en/ });
    expect(expiry).toHaveTextContent('30 días');
    expect(expiry).toHaveFocus();
    const note = within(dialog).getByRole('textbox', { name: 'Nota (opcional)' });
    expect(note).toHaveValue('');
    expect(note).toHaveAttribute('placeholder', 'Ej.: para el equipo de soporte de ACME');
    const group = within(dialog).getByRole('radiogroup', { name: 'Adjuntos' });
    expect(within(group).getByRole('radio', { name: 'Incluir adjuntos' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(within(group).getByRole('radio', { name: 'Solo el texto' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Crear link' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { level: 3, name: 'Links de este documento' })
    ).toBeInTheDocument();
  });

  it('TS-20: crear un link de 15 días lleva a "link creado"', () => {
    resolveWith();
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: /Vence en/ }));
    fireEvent.click(screen.getByRole('option', { name: '15 días' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota (opcional)' }), {
      target: { value: 'para soporte ACME' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
    expect(mutate).toHaveBeenCalledWith(
      { expiresInDays: 15, includeAttachments: true, note: 'para soporte ACME' },
      expect.any(Object)
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copiá el link ahora: por seguridad, no lo vas a poder volver a ver.'
    );
    const link = screen.getByRole('textbox', { name: 'Link' });
    expect(link).toHaveValue(URL_);
    expect(link).toHaveAttribute('readonly');
    expect(link).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    [/Vence en/, 'Nota (opcional)', 'Adjuntos'].forEach((name) => {
      expect(screen.queryByRole('combobox', { name })).toBeNull();
      expect(screen.queryByRole('textbox', { name })).toBeNull();
      expect(screen.queryByRole('radiogroup', { name })).toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Crear link' })).toBeNull();
    expect(screen.queryByText(/Cualquiera que tenga el link/)).toBeNull();
  });

  it('TS-21: "Solo el texto" manda includeAttachments false', () => {
    setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Solo el texto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
    expect(mutate).toHaveBeenCalledWith(
      { expiresInDays: 30, includeAttachments: false },
      expect.any(Object)
    );
  });

  it('TS-22: creando deshabilita el botón', () => {
    createState({ isPending: true });
    setup();
    const button = screen.getByRole('button', { name: 'Crear link' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  describe('copiar', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      Reflect.deleteProperty(navigator, 'clipboard');
    });

    it('TS-23: copia y vuelve a "Copiar" a los 2 s', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      resolveWith();
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
      });
      expect(writeText).toHaveBeenCalledWith(URL_);
      expect(screen.getByRole('button', { name: /Copiado/ })).toBeInTheDocument();
      expect(
        screen.getAllByText('Copiado').some((node) => node.getAttribute('aria-live') === 'polite')
      ).toBe(true);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    });

    it('TS-24: sin portapapeles selecciona el texto', async () => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      resolveWith();
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
      const link = screen.getByRole('textbox', { name: 'Link' }) as HTMLInputElement;
      (screen.getByRole('button', { name: 'Copiar' }) as HTMLElement).focus();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
      });
      expect(link).toHaveFocus();
      expect(link.selectionStart).toBe(0);
      expect(link.selectionEnd).toBe(URL_.length);
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    });
  });

  it('TS-25: cerrar descarta la URL', () => {
    resolveWith();
    const onClose = vi.fn();
    const { rerender } = render(<ShareDocumentDialog open doc={DOC} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
    rerender(<ShareDocumentDialog open={false} doc={DOC} onClose={onClose} />);
    rerender(<ShareDocumentDialog open doc={DOC} onClose={onClose} />);
    expect(screen.queryByRole('textbox', { name: 'Link' })).toBeNull();
    expect(screen.getByRole('combobox', { name: /Vence en/ })).toHaveTextContent('30 días');
    expect(screen.getByRole('textbox', { name: 'Nota (opcional)' })).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Incluir adjuntos' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(document.body.innerHTML).not.toContain('jds_');
  });

  it('TS-26: Escape y click en el fondo cierran; el foco vuelve al disparador', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const { rerender, unmount } = render(<ShareDocumentDialog open doc={DOC} onClose={onClose} />);
    fireEvent.keyDown(dialogOf(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(dialogOf());
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(<ShareDocumentDialog open={false} doc={DOC} onClose={onClose} />);
    expect(trigger).toHaveFocus();
    unmount();
    trigger.remove();
  });

  it('P-11: Escape dentro de O-02 no cierra O-12', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Revocar link' }), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('TS-27: posible secreto, "Compartir igual"', () => {
    rejectWith('secret_warning_not_acknowledged');
    resolveWith();
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este documento parece contener una clave o un token. Si lo compartís, cualquiera con el link lo va a poder leer.'
    );
    expect(screen.queryByRole('button', { name: 'Crear link' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Compartir igual' }));
    expect(mutate).toHaveBeenLastCalledWith(
      { expiresInDays: 30, includeAttachments: true, acknowledgeSecretWarning: true },
      expect.any(Object)
    );
    expect(screen.getByRole('textbox', { name: 'Link' })).toHaveValue(URL_);
  });

  it('TS-28: sharing_blocked al crear', () => {
    rejectWith('sharing_blocked', 403);
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La carpeta de este documento no permite compartirlo fuera de Jiku.'
    );
    expect(screen.queryByRole('combobox', { name: /Vence en/ })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Nota (opcional)' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Adjuntos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Revocar' })).toBeInTheDocument();
  });

  it('TS-29: carpeta con sharingBlocked abre bloqueada', () => {
    const doc = {
      ...(DOC as object),
      folder: { ...(DOC as { folder: object }).folder, sharingBlocked: true },
    };
    setup(doc as never);
    expect(
      screen.getByText('La carpeta de este documento no permite compartirlo fuera de Jiku.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nota (opcional)' })).toBeNull();
    const revoke = screen.getByRole('button', { name: 'Revocar' });
    expect(revoke).toBeEnabled();
    expect(revoke).toHaveFocus();
  });

  it('TS-30: share_expiry_invalid marca el selector', () => {
    rejectWith('share_expiry_invalid');
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
    const expiry = screen.getByRole('combobox', { name: /Vence en/ });
    expect(expiry).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('El vencimiento no es válido. Elegí entre 7 y 180 días.')
    ).toBeVisible();
    expect(expiry).toHaveTextContent('30 días');
  });

  it.each([
    ['sharing_not_configured', 404, 'Compartir no está habilitado en esta instalación.'],
    [
      'module_unavailable',
      503,
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.',
    ],
    ['permission_denied', 403, 'No tenés permiso para compartir este documento.'],
    ['gateway_timeout', 504, 'No se pudo crear el link. Intentá de nuevo.'],
  ])('TS-31: %s', (code, status, message) => {
    rejectWith(code, status);
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Nota (opcional)' }), {
      target: { value: 'hola' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear link' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('textbox', { name: 'Nota (opcional)' })).toHaveValue('hola');
    expect(screen.getByRole('button', { name: 'Crear link' })).toBeEnabled();
  });
});
