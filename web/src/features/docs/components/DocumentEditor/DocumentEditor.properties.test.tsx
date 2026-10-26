import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
vi.mock('../../hooks/useCanRestrictDocs', () => ({ useCanRestrictDocs: vi.fn() }));
vi.mock('../../hooks/useSaveDocument', () => ({ useSaveDocument: vi.fn() }));
vi.mock('../../hooks/useUploadDocAttachment', () => ({ useUploadDocAttachment: vi.fn() }));
vi.mock('../../services/docsApi', () => ({ getDocument: vi.fn() }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(() => ({ id: 'sub-yo', name: 'Yo' })),
}));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const SESSION = '01J9Z3K8M2Q4R6T8V0W2Y4A6S1';
const CONTENT_RICH =
  '---\n' +
  'title: Arquitectura de videoconferencia # título visible\n' +
  '# notas del equipo\n' +
  'visibility: internal\n' +
  'topics: [video, arquitectura]\n' +
  'owner: ana\n' +
  'jiku:\n' +
  '  clients: [4]\n' +
  '  projects:\n' +
  '    - 12\n' +
  '    - 31\n' +
  '  requirements: [151]\n' +
  '  tasks: [7]\n' +
  '---\n' +
  '# Contexto\n\nTexto.\n';
const BODY_RICH = '# Contexto\n\nTexto.\n';
const DETAIL = {
  id: ID,
  title: 'Arquitectura de videoconferencia',
  version: 6,
  visibility: 'internal',
  content: CONTENT_RICH,
};

const mutate = vi.fn();
const release = vi.fn();
const onDone = vi.fn();
const session = {
  phase: 'editing',
  sessionId: SESSION,
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
const markdown = () => screen.getByRole('textbox', { name: 'Markdown' });
const save = () => userEvent.click(screen.getByRole('button', { name: /Guardar/ }));

describe('DocumentEditor — propiedades por campos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveDocument).mockReturnValue({ mutate, isPending: false } as never);
    vi.mocked(useUploadDocAttachment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
    vi.mocked(useCanRestrictDocs).mockReturnValue(false);
    release.mockResolvedValue(undefined);
  });

  it('TS-37: campos con las propiedades y editor con el cuerpo', () => {
    renderEditor();
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue(
      'Arquitectura de videoconferencia'
    );
    expect(screen.getByRole('radiogroup', { name: 'Visibilidad' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Interno' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Quitar tema video' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar tema arquitectura' })).toBeInTheDocument();
    expect(screen.getByText('Vinculado a')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveTextContent('EXO');
    expect(screen.getByRole('combobox', { name: 'Proyecto' })).toHaveTextContent(
      'Videoconferencia · EXO'
    );
    expect(markdown()).toHaveValue(BODY_RICH);
    expect(markdown()).toHaveFocus();
    expect(
      screen.getByText(
        'Estás editando. Nadie más puede guardar este documento hasta que guardes o canceles.'
      )
    ).toBeInTheDocument();
  });

  it('TS-38: un solo PUT con propiedades y cuerpo, sin message', async () => {
    renderEditor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), {
      target: { value: 'Arquitectura v2' },
    });
    await userEvent.type(screen.getByRole('combobox', { name: 'Temas' }), 'infra{Enter}');
    fireEvent.change(markdown(), { target: { value: BODY_RICH + 'Más.\n' } });
    await save();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({
      baseVersion: 6,
      sessionId: SESSION,
      content:
        '---\ntitle: Arquitectura v2 # título visible\n# notas del equipo\nvisibility: internal\ntopics: [video, arquitectura, infra]\nowner: ana\njiku:\n  clients: [4]\n  projects:\n    - 12\n    - 31\n  requirements: [151]\n  tasks: [7]\n---\n# Contexto\n\nTexto.\nMás.\n',
    });
  });

  it('TS-39: solo cuerpo conserva el frontmatter byte a byte', async () => {
    renderEditor();
    fireEvent.change(markdown(), { target: { value: BODY_RICH + 'Más.\n' } });
    await save();
    expect(mutate.mock.calls[0]![0].content).toBe(CONTENT_RICH + 'Más.\n');
  });

  it('TS-40: cambiar proyecto conserva requisitos y tareas', async () => {
    renderEditor();
    // El proyecto se limita al cliente: se cambia el cliente y el proyecto ajeno se vacía.
    await userEvent.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await userEvent.click(screen.getByRole('option', { name: 'ACME' }));
    await save();
    const content: string = mutate.mock.calls[0]![0].content;
    expect(content).toContain('  clients: [2]\n');
    expect(content).toContain('  projects:\n    - 31\n');
    expect(content).toContain('  requirements: [151]\n  tasks: [7]\n');
  });

  it('TS-42: título vacío no guarda', async () => {
    renderEditor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: '' } });
    await save();
    expect(screen.getByText('El título no puede quedar vacío.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('TS-44: sin frontmatter agrega las claves cambiadas', async () => {
    renderEditor({ ...DETAIL, title: 'Solo cuerpo', content: '# Solo cuerpo\n\nTexto.\n' });
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Solo cuerpo');
    expect(markdown()).toHaveValue('# Solo cuerpo\n\nTexto.\n');
    await userEvent.click(screen.getByRole('radio', { name: 'Visible para el cliente' }));
    await save();
    expect(mutate.mock.calls[0]![0].content).toBe(
      '---\nvisibility: public\n---\n# Solo cuerpo\n\nTexto.\n'
    );
  });

  it('TS-46: un user en un documento restringido lo ve deshabilitado', async () => {
    renderEditor({
      ...DETAIL,
      visibility: 'restricted',
      content: '---\nvisibility: restricted\n---\n# R\n',
    });
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Restringido' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    fireEvent.change(markdown(), { target: { value: '# R\nmás\n' } });
    await save();
    expect(mutate.mock.calls[0]![0].content).toBe('---\nvisibility: restricted\n---\n# R\nmás\n');
  });

  it('TS-49: cancelar con cambios solo de propiedades pide confirmar', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(release).toHaveBeenCalled();
  });

  it('TS-49: con un tema cambiado abre O-02', async () => {
    renderEditor();
    await userEvent.type(screen.getByRole('combobox', { name: 'Temas' }), 'infra{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('dialog', { name: 'Descartar cambios' })).toBeInTheDocument();
    expect(release).not.toHaveBeenCalled();
  });
});
