import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSaveDocument } from '../../hooks/useSaveDocument';
import { useUploadDocAttachment } from '../../hooks/useUploadDocAttachment';
import { DocumentEditor } from './DocumentEditor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/features/clients', () => ({
  useClients: () => ({
    data: [
      { id: 4, name: 'EXO' },
      { id: 2, name: 'ACME' },
    ],
  }),
}));
vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [
      { id: 12, name: 'Videoconferencia', client: { id: 4, name: 'EXO' } },
      { id: 31, name: 'Portal', client: { id: 2, name: 'ACME' } },
    ],
  }),
}));
vi.mock('../../hooks/useTopicSuggestions', () => ({
  useTopicSuggestions: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('../../hooks/useCanRestrictDocs', () => ({ useCanRestrictDocs: vi.fn(() => false) }));
vi.mock('../../hooks/useSaveDocument', () => ({ useSaveDocument: vi.fn() }));
vi.mock('../../hooks/useUploadDocAttachment', () => ({ useUploadDocAttachment: vi.fn() }));
vi.mock('../../services/docsApi', () => ({ getDocument: vi.fn() }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(() => ({ id: 'sub-yo', name: 'Yo' })),
}));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const LINK = 'https://jiku.example.com/docs/attachments/01J9Z3K8M2Q4R6T8V0W2Y4A6D1';

const DOC = {
  id: ID,
  title: 'Arquitectura',
  fileName: 'arquitectura.md',
  version: 6,
  content: '# Arquitectura\n\nTexto',
};

const mutate = vi.fn();
const upload = vi.fn();
const release = vi.fn();
const markBlocked = vi.fn();
const onDone = vi.fn();

const makeSession = (over: Record<string, unknown> = {}) =>
  ({
    phase: 'editing',
    sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6E2',
    blockedBy: null,
    start: vi.fn(),
    release,
    markBlocked,
    clearBlocked: vi.fn(),
    ...over,
  }) as never;

const renderEditor = (session = makeSession()) => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <DocumentEditor doc={DOC as never} session={session} onDone={onDone} />
    </QueryClientProvider>
  );
};

const failWith = (error: unknown) =>
  mutate.mockImplementation((_payload, options) => options.onError(error));
const textbox = () => screen.getByRole('textbox', { name: 'Markdown' });

describe('DocumentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveDocument).mockReturnValue({ mutate, isPending: false } as never);
    vi.mocked(useUploadDocAttachment).mockReturnValue({
      mutate: upload,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    release.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('TS-73: el editor, la vista previa, adjuntos, mensaje y acciones; foco en el editor', () => {
    renderEditor();
    expect(
      screen.getByText('Estás editando. Nadie más puede guardar este documento hasta que guardes o canceles.')
    ).toBeInTheDocument();
    expect(textbox()).toHaveValue('# Arquitectura\n\nTexto');
    expect(textbox()).toHaveFocus();
    expect(screen.getByRole('heading', { level: 2, name: 'Vista previa' })).toBeInTheDocument();
    expect(screen.getByText(/Arrastrá archivos aquí/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensaje de la versión (opcional)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeInTheDocument();
  });

  it('TS-20: el editor muestra el cuerpo y la vista previa no tiene frontmatter', () => {
    const content =
      '---\ntitle: Arquitectura\njiku:\n  projects: [12]\n---\n# Contexto\n\nTexto.\n';
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DocumentEditor
          doc={{ ...DOC, content } as never}
          session={makeSession()}
          onDone={onDone}
        />
      </QueryClientProvider>
    );
    expect(screen.getByRole('heading', { name: 'Contexto' })).toBeInTheDocument();
    const preview = screen.getByRole('heading', { name: 'Vista previa' })
      .parentElement as HTMLElement;
    expect(preview).not.toHaveTextContent('jiku:');
    expect(preview).not.toHaveTextContent('title: Arquitectura');
    expect(textbox()).toHaveValue('# Contexto\n\nTexto.\n');
  });

  it('TS-76: la vista previa se actualiza con debounce de 300 ms', () => {
    vi.useFakeTimers();
    renderEditor();
    fireEvent.change(textbox(), { target: { value: '# Arquitectura\n\nTexto\n\n## Nuevo' } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.queryByRole('heading', { name: 'Nuevo' })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('heading', { name: 'Nuevo' })).toBeInTheDocument();
  });

  it('TS-77: guarda con la base, libera, avisa y vuelve a la lectura', async () => {
    mutate.mockImplementation((_payload, options) => options.onSuccess({ id: ID, version: 7 }));
    renderEditor();
    fireEvent.change(textbox(), { target: { value: '# Arquitectura v7' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensaje de la versión (opcional)' }), {
      target: { value: 'agrego pasos' },
    });
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(mutate.mock.calls[0][0]).toEqual({
      baseVersion: 6,
      content: '# Arquitectura v7',
      sessionId: '01J9Z3K8M2Q4R6T8V0W2Y4A6E2',
      message: 'agrego pasos',
    });
    expect(release).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Guardaste la versión 7. Quedó protegida.');
    expect(onDone).toHaveBeenCalled();
  });

  it('TS-79: con aviso de secreto usa toast.warning', async () => {
    mutate.mockImplementation((_payload, options) =>
      options.onSuccess({ id: ID, version: 7, warnings: ['possible_secret_detected'] })
    );
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(toast.warning).toHaveBeenCalledWith(
      'Guardaste la versión 7. Revisalo: parece contener una clave o un token.'
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('TS-78: la base no cambia aunque el query del documento se actualice', async () => {
    mutate.mockImplementation((_p, options) => options.onSuccess({ id: ID, version: 7 }));
    const client = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <DocumentEditor doc={DOC as never} session={makeSession()} onDone={onDone} />
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={client}>
        <DocumentEditor
          doc={{ ...DOC, version: 8, content: 'otro' } as never}
          session={makeSession()}
          onDone={onDone}
        />
      </QueryClientProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(mutate.mock.calls[0][0].baseVersion).toBe(6);
    expect(textbox()).toHaveValue('# Arquitectura\n\nTexto');
  });

  it('TS-83: document_locked al guardar conserva el texto y marca el bloqueo', async () => {
    const details = { holder: 'sub-ana', via: 'human', expiresAt: '2026-10-24T14:40:00.000Z' };
    failWith({ code: 'document_locked', message: 'x', status: 409, details });
    renderEditor();
    fireEvent.change(textbox(), { target: { value: 'mi texto' } });
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(markBlocked).toHaveBeenCalledWith(details);
    expect(textbox()).toHaveValue('mi texto');
  });

  it('muestra el bloqueo cuando la sesión lo trae (P-14)', () => {
    renderEditor(
      makeSession({
        phase: 'lost',
        blockedBy: {
          holder: 'sub-ana',
          holderName: 'Ana Gómez',
          via: 'human',
          expiresAt: '2026-10-24T14:40:00.000Z',
        },
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ana Gómez lo está editando hasta las 14:40. Podés leerlo mientras tanto.'
    );
    expect(screen.queryByText(/Se perdió la reserva/)).toBeNull();
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
    expect(textbox()).toBeInTheDocument();
  });

  it.each([
    [
      { code: 'frontmatter_invalid', message: 'falta cerrar ---' },
      'Las propiedades no son válidas: falta cerrar ---.',
    ],
    [
      { code: 'invalid_relation', message: 'projects: 999' },
      'Uno de los vínculos no existe: projects: 999.',
    ],
    [
      { code: 'content_too_large', message: 'El contenido supera los 256 KiB' },
      'El documento supera los 256 KiB que se pueden guardar desde acá.',
    ],
  ])('TS-84: error de validación %j', async (error, text) => {
    failWith({ ...error, status: 400 });
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(textbox()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([
    { code: 'gateway_timeout', status: 504 },
    { code: 'internal_error', status: 500 },
    { code: 'module_unavailable', status: 503 },
  ])('TS-85: error de sistema %j', async (error) => {
    failWith({ ...error, message: 'x' });
    renderEditor();
    fireEvent.change(textbox(), { target: { value: 'mi texto' } });
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo guardar. Tu texto sigue en el editor; intentá de nuevo.'
    );
    expect(textbox()).toHaveValue('mi texto');
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('TS-86: permission_denied pasa a solo lectura', async () => {
    failWith({ code: 'permission_denied', message: 'x', status: 403 });
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    expect(toast.error).toHaveBeenCalledWith('No tenés permiso para editar este documento.');
    expect(textbox()).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('TS-87: reserva perdida', () => {
    renderEditor(makeSession({ phase: 'lost' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Se perdió la reserva de edición. Tu texto sigue acá; si nadie más lo tomó, vas a poder guardar igual.'
    );
    expect(screen.queryByText(/Lo estás editando/)).toBeNull();
    expect(textbox()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vista previa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
  });

  it('TS-88: cancelar sin cambios libera y vuelve sin diálogo', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(release).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('TS-89: cancelar con cambios pide confirmar con O-02', async () => {
    renderEditor();
    fireEvent.change(textbox(), { target: { value: 'cambié algo' } });
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = screen.getByRole('dialog', { name: 'Descartar cambios' });
    expect(dialog).toHaveTextContent(
      'Vas a perder lo que escribiste desde la última vez que guardaste.'
    );
    expect(screen.getByRole('button', { name: 'Seguir editando' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(release).not.toHaveBeenCalled();
    expect(textbox()).toHaveValue('cambié algo');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(release).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('TS-90: beforeunload solo con cambios sin guardar', () => {
    renderEditor();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(textbox(), { target: { value: 'cambié algo' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('suppressNotices oculta los avisos del editor', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DocumentEditor
          doc={DOC as never}
          session={makeSession({ phase: 'lost' })}
          suppressNotices
          onDone={onDone}
        />
      </QueryClientProvider>
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('adjuntos (TS-93, TS-94)', () => {
    const drop = (file: File) =>
      fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {
        target: { files: [file] },
      });

    it('TS-93: inserta la imagen en la posición del cursor', () => {
      upload.mockImplementation((_file, options) =>
        options.onSuccess({ id: 'D1', fileName: 'diagrama.png', mimeType: 'image/png', link: LINK })
      );
      renderEditor();
      fireEvent.change(textbox(), { target: { value: 'Hola mundo' } });
      (textbox() as HTMLTextAreaElement).setSelectionRange(4, 4);
      fireEvent.select(textbox());
      drop(new File(['x'], 'diagrama.png', { type: 'image/png' }));
      expect(textbox()).toHaveValue(`Hola![diagrama.png](${LINK}) mundo`);
    });

    it('TS-94: sin posición previa inserta al final un archivo que no es imagen', () => {
      upload.mockImplementation((_file, options) =>
        options.onSuccess({ id: 'D1', fileName: 'export.csv', mimeType: 'text/csv', link: LINK })
      );
      renderEditor();
      drop(new File(['a,b'], 'export.csv', { type: 'text/csv' }));
      expect((textbox() as HTMLTextAreaElement).value.endsWith(`[export.csv](${LINK})`)).toBe(true);
      expect((textbox() as HTMLTextAreaElement).value.startsWith('# Arquitectura')).toBe(true);
    });
  });
});
