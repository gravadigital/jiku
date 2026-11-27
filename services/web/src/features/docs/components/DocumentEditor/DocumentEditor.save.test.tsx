import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanRestrictDocs } from '../../hooks/useCanRestrictDocs';
import { useSaveDocument } from '../../hooks/useSaveDocument';
import { useUploadDocAttachment } from '../../hooks/useUploadDocAttachment';
import { DocumentEditor } from './DocumentEditor';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/features/clients', () => ({ useClients: () => ({ data: [] }) }));
vi.mock('@/features/projects/hooks/useProjects', () => ({ useProjects: () => ({ data: [] }) }));
vi.mock('../../hooks/useTopicSuggestions', () => ({
  useTopicSuggestions: () => ({ data: undefined, isFetching: false }),
}));
vi.mock('../../hooks/useCanRestrictDocs', () => ({ useCanRestrictDocs: vi.fn() }));
vi.mock('../../hooks/useSaveDocument', () => ({ useSaveDocument: vi.fn() }));
vi.mock('../../hooks/useUploadDocAttachment', () => ({ useUploadDocAttachment: vi.fn() }));
vi.mock('../../services/docsApi', () => ({ getDocument: vi.fn() }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(() => ({ id: '7f3c2a10-0000-4000-8000-000000000001', name: 'Yo', zitadelId: 'sub-yo' })),
}));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const CONTENT_BAD = '---\ntitle: [sin cerrar\n---\n# Cuerpo\n';
const DETAIL = {
  id: ID,
  title: 'Arq',
  version: 6,
  visibility: 'internal',
  content: '---\ntitle: Arq\nvisibility: internal\n---\n# A\n',
};

const mutate = vi.fn();
const release = vi.fn();
const onDone = vi.fn();
const session = {
  phase: 'editing',
  sessionId: 'S',
  blockedBy: null,
  start: vi.fn(),
  release,
  markBlocked: vi.fn(),
  clearBlocked: vi.fn(),
} as never;

const renderEditor = (doc: Record<string, unknown> = DETAIL) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentEditor doc={doc as never} session={session} onDone={onDone} />
    </QueryClientProvider>
  );
const save = () => userEvent.click(screen.getByRole('button', { name: /Guardar/ }));

describe('DocumentEditor — guardado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveDocument).mockReturnValue({ mutate, isPending: false } as never);
    vi.mocked(useUploadDocAttachment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useCanRestrictDocs).mockReturnValue(true);
    release.mockResolvedValue(undefined);
  });

  it('TS-41: el mensaje protege la versión', async () => {
    mutate.mockImplementation((_p, options) => options.onSuccess({ id: ID, version: 7 }));
    renderEditor();
    const field = screen.getByRole('textbox', { name: 'Mensaje de la versión (opcional)' });
    expect(field).toHaveAttribute('placeholder', 'Ej.: cierre de sprint');
    expect(
      screen.getByText(
        'Con mensaje, esta versión queda protegida: no se borra al compactar el historial.'
      )
    ).toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'Cierre de sprint' } });
    await save();
    expect(mutate.mock.calls[0]![0].message).toBe('Cierre de sprint');
    expect(toast.success).toHaveBeenCalledWith('Guardaste la versión 7. Quedó protegida.');
    expect(release).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('TS-43: propiedades ilegibles editan el contenido completo', async () => {
    renderEditor({ ...DETAIL, content: CONTENT_BAD });
    expect(
      screen.getByText(
        'No pudimos leer las propiedades de este documento. Editá el texto completo, propiedades incluidas, y al guardar el módulo te va a decir si algo no es válido.'
      )
    ).toBeInTheDocument();
    for (const name of ['Título', 'Visibilidad', 'Temas', 'Cliente', 'Proyecto']) {
      expect(
        screen.queryByRole(
          name === 'Visibilidad' ? 'radiogroup' : name === 'Título' ? 'textbox' : 'combobox',
          { name }
        )
      ).not.toBeInTheDocument();
    }
    const markdown = screen.getByRole('textbox', { name: 'Markdown' });
    expect(markdown).toHaveValue(CONTENT_BAD);
    fireEvent.change(markdown, { target: { value: CONTENT_BAD + 'x' } });
    await save();
    expect(mutate.mock.calls[0]![0].content).toBe(CONTENT_BAD + 'x');
  });

  it('TS-45: permission_denied al restringir queda junto al selector y sigue editable', async () => {
    mutate.mockImplementation((_p, options) =>
      options.onError({ code: 'permission_denied', status: 403, message: 'Denied' })
    );
    renderEditor();
    await userEvent.click(screen.getByRole('radio', { name: 'Restringido' }));
    expect(
      screen.getByText('Al guardar, los links compartidos de este documento dejan de funcionar.')
    ).toBeInTheDocument();
    await save();
    expect(toast.error).toHaveBeenCalledWith('Solo la conducción puede restringir un documento.');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Solo la conducción puede restringir un documento.'
    );
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeInTheDocument();
  });

  it('TS-45: otro permission_denied pasa a solo lectura como siempre', async () => {
    mutate.mockImplementation((_p, options) =>
      options.onError({ code: 'permission_denied', status: 403, message: 'Denied' })
    );
    renderEditor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), {
      target: { value: '# B\n' },
    });
    await save();
    expect(toast.error).toHaveBeenCalledWith('No tenés permiso para editar este documento.');
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
  });

  it.each([
    [{ code: 'frontmatter_invalid', message: 'topics' }, 'Las propiedades no son válidas: topics.'],
    [
      { code: 'invalid_relation', message: 'projects: 99' },
      'Uno de los vínculos no existe: projects: 99.',
    ],
  ])('TS-47: %j', async (error, text) => {
    mutate.mockImplementation((_p, options) => options.onError({ ...error, status: 400 }));
    renderEditor();
    await save();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
  });
});
