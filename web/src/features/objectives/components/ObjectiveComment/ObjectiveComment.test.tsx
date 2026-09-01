import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateComment } from '@/features/objectives/services/commentsApi';
import { ObjectiveComment } from './ObjectiveComment';

vi.mock('@root/assets/edit.svg', () => ({ default: 'edit-icon.svg' }));

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

let sessionData: { user: { id: string; roles: string[] } } | null = null;

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: sessionData }),
}));

function mockSession(userId: string, roles: string[] = ['user']) {
  sessionData = { user: { id: userId, roles } };
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : ''} alt={alt} />
  ),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/features/objectives/services/commentsApi', () => ({
  updateComment: vi.fn(),
}));

vi.mock('@/features/attachments/components/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}));

let attachmentsData: Array<{ id: number; fileId: number; fileName: string }> = [];

vi.mock('@/features/attachments/hooks/useAttachments', () => ({
  useAttachments: () => ({ data: attachmentsData, isLoading: false }),
}));

const baseProps = {
  authorName: 'Agustin Nava',
  authorId: 'u-1',
  date: new Date('2026-04-24T10:00:00Z'),
  objectiveId: 42,
  commentId: 100,
  editedAt: null,
  editedBy: null,
  editedByName: null,
  visibilityLevel: 'public' as const,
};

describe('ObjectiveComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionData = null;
    attachmentsData = [];
  });

  it('usa MarkdownViewer para renderizar el contenido (no ReactMarkdown crudo)', () => {
    render(<ObjectiveComment {...baseProps} content="Hola ![attach:74] mundo [attach:75]" />);

    const viewer = screen.getByTestId('markdown-viewer');
    expect(viewer).toBeInTheDocument();
    expect(viewer).toHaveTextContent('Hola ![attach:74] mundo [attach:75]');
  });

  it('muestra el nombre del autor', () => {
    render(<ObjectiveComment {...baseProps} content="contenido" />);
    expect(screen.getByText('Agustin Nava')).toBeInTheDocument();
  });

  it('muestra el badge "Público" para comentarios públicos', () => {
    render(<ObjectiveComment {...baseProps} content="hola" visibilityLevel="public" />);
    expect(screen.getByText('👁')).toBeInTheDocument();
  });

  describe('Marca de identidad automática (S-019)', () => {
    it('muestra la marca en el header cuando el autor es una identidad de servicio', () => {
      render(
        <ObjectiveComment
          {...baseProps}
          authorName="Conector Portal"
          authorId="u-svc"
          authorIdentityType="service"
          content="sincronizado desde el portal"
        />
      );

      expect(screen.getByText('Conector Portal')).toBeInTheDocument();
      expect(screen.getByText('Automático')).toBeInTheDocument();
    });

    it('no muestra la marca cuando el autor es una persona', () => {
      render(<ObjectiveComment {...baseProps} authorIdentityType="person" content="hola" />);

      expect(screen.getByText('Agustin Nava')).toBeInTheDocument();
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('no muestra la marca cuando la prop no viene (llamador viejo)', () => {
      render(<ObjectiveComment {...baseProps} content="hola" />);

      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('TS-22: la marca sigue presente después de entrar en modo edición', async () => {
      mockSession('u-svc');

      render(
        <ObjectiveComment
          {...baseProps}
          authorName="Conector Portal"
          authorId="u-svc"
          authorIdentityType="service"
          content="sincronizado desde el portal"
        />
      );

      await userEvent.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
      expect(screen.getByText('Automático')).toBeInTheDocument();
    });
  });

  describe('Marca "(editado)" y boton "Editar" (S-048)', () => {
    // TS-32 (CA-6, CA-7): editedAt null -> sin marca
    it('TS-32: no muestra "(editado)" cuando editedAt es null', () => {
      render(<ObjectiveComment {...baseProps} content="hola" editedAt={null} />);
      expect(screen.queryByText('(editado)')).not.toBeInTheDocument();
    });

    it('muestra "(editado)" cuando editedAt existe y el editor es el autor', () => {
      render(
        <ObjectiveComment
          {...baseProps}
          content="hola"
          editedAt="2026-09-01T10:00:00.000Z"
          editedBy="u-1"
        />
      );
      expect(screen.getByText('(editado)')).toBeInTheDocument();
      expect(screen.queryByText(/\(editado por/)).not.toBeInTheDocument();
    });

    // TS-33 (CA-5): editedBy distinto del autor -> "(editado por X)"
    it('TS-33: muestra "(editado por X)" cuando editedBy difiere del autor', () => {
      render(
        <ObjectiveComment
          {...baseProps}
          content="hola"
          editedAt="2026-09-01T10:00:00.000Z"
          editedBy="u-2"
          editedByName="Ana Gomez"
        />
      );
      expect(screen.getByText('(editado por Ana Gomez)')).toBeInTheDocument();
    });

    it('degrada a "(editado)" cuando editedByName no se pudo resolver', () => {
      render(
        <ObjectiveComment
          {...baseProps}
          content="hola"
          editedAt="2026-09-01T10:00:00.000Z"
          editedBy="u-2"
          editedByName={null}
        />
      );
      expect(screen.getByText('(editado)')).toBeInTheDocument();
    });

    // TS-34 (CA-4, CA-5): admin edita comentario ajeno
    it('TS-34: el botón "Editar" aparece para un admin en comentario ajeno', () => {
      mockSession('u-9', ['admin']);
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      expect(screen.getByRole('button', { name: 'Editar comentario' })).toBeInTheDocument();
    });

    // TS-35 (CA-4): user sin ser autor no ve el boton
    it('TS-35: el botón "Editar" NO aparece para un user en comentario ajeno', () => {
      mockSession('u-9', ['user']);
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      expect(screen.queryByRole('button', { name: 'Editar comentario' })).not.toBeInTheDocument();
    });

    it('el botón "Editar" aparece para el autor del comentario', () => {
      mockSession('u-1', ['user']);
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      expect(screen.getByRole('button', { name: 'Editar comentario' })).toBeInTheDocument();
    });
  });

  describe('Modo edición inline (S-048)', () => {
    beforeEach(() => {
      mockSession('u-1');
    });

    // TS-36 (CA-8): sin checkbox de comentario publico en edicion
    it('TS-36: en edición no se ofrece el checkbox de comentario público', async () => {
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(
        screen.queryByRole('checkbox', { name: /público/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/público/i)).not.toBeInTheDocument();
    });

    // TS-37 (CA-9): cancelar restaura el contenido original sin llamar a la api
    it('TS-37: cancelar restaura el contenido original', async () => {
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'otro');

      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.getByText('hola')).toBeInTheDocument();
      expect(updateComment).not.toHaveBeenCalled();
    });

    it('al entrar en edición precarga el editor con el texto actual', async () => {
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByDisplayValue('hola')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    });

    it('éxito muestra el toast y vuelve a modo lectura', async () => {
      vi.mocked(updateComment).mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Comentario editado exitosamente');
      });
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
    });

    // TS-38 (CA-10): error de autoria muestra el mensaje especifico via commentErrorMessage
    it('TS-38: comment_not_owned muestra el mensaje específico', async () => {
      vi.mocked(updateComment).mockRejectedValue({
        code: 'comment_not_owned',
        message: 'Access denied',
        status: 403,
      });
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('No podés editar un comentario que no es tuyo');
      });
      expect(screen.getByText('hola')).toBeInTheDocument();
    });

    it('código desconocido cae al mensaje fallback', async () => {
      vi.mocked(updateComment).mockRejectedValue({
        code: 'internal_error',
        message: 'Internal error',
        status: 500,
      });
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" content="hola" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Hubo un error al editar el comentario');
      });
    });
  });

  describe('Edición de adjuntos del comentario (S-048)', () => {
    beforeEach(() => {
      mockSession('u-1');
      attachmentsData = [
        { id: 40, fileId: 3, fileName: 'informe.pdf' },
        { id: 41, fileId: 9, fileName: 'captura.png' },
      ];
    });

    it('muestra los adjuntos actuales del comentario, con su nombre de archivo', async () => {
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" commentId={7} content="ver adjuntos" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByText('informe.pdf')).toBeInTheDocument();
      expect(screen.getByText('captura.png')).toBeInTheDocument();
    });

    // TS-30 equivalente (accesibilidad de detalle-tarea): cada boton de quitar nombra su archivo
    it('cada control de quitar adjunto nombra su archivo en el nombre accesible', async () => {
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" commentId={7} content="ver adjuntos" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));

      expect(screen.getByRole('button', { name: /informe\.pdf/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /captura\.png/ })).toBeInTheDocument();
    });

    // TS-31: manda el conjunto completo de fileIds
    it('TS-31: guardar manda el conjunto completo de fileIds, no un delta', async () => {
      vi.mocked(updateComment).mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" commentId={7} content="ver adjuntos" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      await user.click(screen.getByRole('button', { name: /captura\.png/ }));

      const editorField = screen.getByDisplayValue(/ver adjuntos/);
      await user.clear(editorField);
      await user.type(editorField, 'texto corregido');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => {
        expect(updateComment).toHaveBeenCalledWith(42, 7, {
          comment: 'texto corregido',
          fileIds: [3],
        });
      });
    });

    it('sin adjuntos, el payload no incluye la clave fileIds', async () => {
      vi.mocked(updateComment).mockResolvedValue(undefined);
      attachmentsData = [];
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" commentId={7} content="hola" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      const editorField = screen.getByDisplayValue('hola');
      await user.clear(editorField);
      await user.type(editorField, 'texto sin adjuntos');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(updateComment).toHaveBeenCalled());
      const [, , body] = vi.mocked(updateComment).mock.calls[0];
      expect(body).not.toHaveProperty('fileIds');
    });

    it('cancelar revierte la eliminación de un adjunto (no persiste el cambio)', async () => {
      const user = userEvent.setup();
      render(<ObjectiveComment {...baseProps} authorId="u-1" commentId={7} content="ver adjuntos" />);

      await user.click(screen.getByRole('button', { name: 'Editar comentario' }));
      await user.click(screen.getByRole('button', { name: /captura\.png/ }));
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(updateComment).not.toHaveBeenCalled();
    });
  });
});
