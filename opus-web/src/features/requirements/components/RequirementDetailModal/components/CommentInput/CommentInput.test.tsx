import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentInput } from './CommentInput';
import { vi } from 'vitest';

const mockUploadFile = vi.fn();
const mockMutate = vi.fn();
const mockUseCreateComment = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null as unknown,
}));
const mockUseIsMobile = vi.fn(() => false);

vi.mock('@/features/attachments/services/attachmentsApi', () => ({
  attachmentsApi: {
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
    getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
    getFilePreviewUrl: (id: number) => `/api/files/${id}/preview`,
  },
}));

vi.mock('@/features/comments/hooks/useCreateComment', () => ({
  useCreateComment: () => mockUseCreateComment(),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock('@/shared/components/ui/RichTextEditor/RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    placeholder,
    disabled,
    uploading,
    uploadingFileName,
    uploadProgress,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    uploading?: boolean;
    uploadingFileName?: string;
    uploadProgress?: number;
  }) => (
    <div>
      <textarea
        data-testid="rich-text-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {uploading && (
        <div role="progressbar" aria-valuenow={uploadProgress}>
          {`Subiendo ${uploadingFileName}... ${uploadProgress}%`}
        </div>
      )}
    </div>
  ),
}));

const IMAGE = new File(['content'], 'foto.png', { type: 'image/png' });
const uploaded = {
  fileId: 1234,
  fileName: 'foto.png',
  mimeType: 'image/png',
  fileSize: 1024,
};

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function attachBtn(): HTMLButtonElement {
  return screen.getByLabelText('Adjuntar archivo al comentario') as HTMLButtonElement;
}

function sendBtn(): HTMLButtonElement {
  return screen.getByLabelText('Enviar comentario') as HTMLButtonElement;
}

function bigFile(): File {
  const file = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 });
  return file;
}

describe('CommentInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    mockUseCreateComment.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  describe('integración RichTextEditor', () => {
    it('renderiza RichTextEditor (no textarea nativo)', () => {
      render(<CommentInput requirementId={10} />);
      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    });

    it('NO renderiza div.attachPreviews separado', () => {
      render(<CommentInput requirementId={10} />);
      expect(document.querySelector('.attachPreviews')).not.toBeInTheDocument();
    });

    it('botón enviar deshabilitado cuando el editor está vacío', () => {
      render(<CommentInput requirementId={10} />);
      expect(sendBtn()).toBeDisabled();
    });
  });

  describe('subida directa', () => {
    it('sube con uploadFile, sin entityType ni entityId', async () => {
      mockUploadFile.mockResolvedValue(uploaded);
      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());
      const args = mockUploadFile.mock.calls[0];
      expect(args[0]).toBe(IMAGE);
      expect(typeof args[1]).toBe('function');
      expect(args).toHaveLength(2);
      expect(JSON.stringify(args[0])).not.toContain('requirement_comment_draft');
    });

    it('TS-25: la subida bloquea el botón de adjuntar y el de enviar', async () => {
      let resolveUpload!: (v: unknown) => void;
      mockUploadFile.mockReturnValue(new Promise((r) => (resolveUpload = r)));

      render(<CommentInput requirementId={10} />);
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      await waitFor(() => expect(attachBtn()).toBeDisabled());
      expect(sendBtn()).toBeDisabled();

      resolveUpload(uploaded);
      await waitFor(() => expect(attachBtn()).not.toBeDisabled());
    });

    it('TS-26: terminada la subida los botones se rehabilitan', async () => {
      mockUploadFile.mockResolvedValue(uploaded);
      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      await waitFor(() => expect(attachBtn()).not.toBeDisabled());
      expect(sendBtn()).not.toBeDisabled();
    });

    it('reporta el progreso real al editor', async () => {
      // La subida queda pendiente a propósito: el bloque de progreso solo existe mientras
      // el `PUT` está en curso, así que resolverla haría desaparecer lo que se asierta.
      mockUploadFile.mockImplementation(async (_file: File, onProgress: (p: number) => void) => {
        onProgress(58);
        await new Promise(() => {});
      });

      render(<CommentInput requirementId={10} />);
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      expect(await screen.findByText('Subiendo foto.png... 58%')).toBeInTheDocument();
    });

    it('TS-33: no arranca una segunda subida en paralelo', async () => {
      mockUploadFile.mockReturnValue(new Promise(() => {}));
      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });
      await waitFor(() => expect(attachBtn()).toBeDisabled());

      fireEvent.click(attachBtn());
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      expect(mockUploadFile).toHaveBeenCalledTimes(1);
    });

    it('TS-34: el fallo de un archivo no invalida los ya subidos', async () => {
      mockUploadFile
        .mockResolvedValueOnce(uploaded)
        .mockRejectedValueOnce({ code: 'file_too_large', status: 400, message: 'too large' });

      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(1));

      fireEvent.change(fileInput(), {
        target: { files: [new File(['y'], 'otro.pdf', { type: 'application/pdf' })] },
      });
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'El archivo supera el tamaño máximo permitido'
        )
      );

      fireEvent.click(sendBtn());
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileIds: [1234] }),
        expect.anything()
      );
    });

    it('TS-42: una URL vencida deja pedir un ticket nuevo', async () => {
      mockUploadFile
        .mockRejectedValueOnce({ code: 'upload_url_expired', status: 403, message: '' })
        .mockResolvedValueOnce(uploaded);

      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
      expect(attachBtn()).not.toBeDisabled();

      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(2));

      fireEvent.click(sendBtn());
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileIds: [1234] }),
        expect.anything()
      );
    });
  });

  describe('fileIds en el envío', () => {
    it('TS-27: el envío manda fileIds, no attachmentIds', async () => {
      mockUploadFile.mockResolvedValue(uploaded);
      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

      fireEvent.change(screen.getByTestId('rich-text-editor'), {
        target: { value: 'ver esto ![attach:1234]' },
      });
      fireEvent.click(sendBtn());

      const payload = mockMutate.mock.calls[0][0];
      expect(payload.fileIds).toEqual([1234]);
      expect(payload).not.toHaveProperty('attachmentIds');
    });

    it('TS-28: sin adjuntos manda fileIds vacío', () => {
      render(<CommentInput requirementId={10} />);

      fireEvent.change(screen.getByTestId('rich-text-editor'), { target: { value: 'hola' } });
      fireEvent.click(sendBtn());

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ comment: 'hola', fileIds: [] }),
        expect.anything()
      );
      expect(mockMutate.mock.calls[0][0]).not.toHaveProperty('attachmentIds');
    });

    it('TS-43: quitar un adjunto del texto lo saca del envío sin disparar borrado', async () => {
      mockUploadFile.mockResolvedValue(uploaded);
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      render(<CommentInput requirementId={10} />);
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });
      await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

      fireEvent.change(screen.getByTestId('rich-text-editor'), {
        target: { value: 'texto sin attach' },
      });
      fireEvent.click(sendBtn());

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileIds: [] }),
        expect.anything()
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('TS-44: el éxito limpia el editor y los adjuntos pendientes', async () => {
      mockMutate.mockImplementation((_payload, opts) => opts?.onSuccess?.());
      render(<CommentInput requirementId={10} />);

      fireEvent.change(screen.getByTestId('rich-text-editor'), { target: { value: 'hola' } });
      fireEvent.click(sendBtn());

      await waitFor(() => expect(screen.getByTestId('rich-text-editor')).toHaveValue(''));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('mensajes de error', () => {
    it('TS-35: el rechazo por tamaño no nombra el límite', async () => {
      mockUploadFile.mockRejectedValue({
        code: 'file_too_large',
        status: 400,
        message: 'File exceeds 10485760 bytes',
      });

      render(<CommentInput requirementId={10} />);
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('El archivo supera el tamaño máximo permitido');
      expect(alert.textContent).not.toMatch(/10\s?MB/i);
    });

    it('TS-36: el rechazo por tipo no enumera extensiones', async () => {
      mockUploadFile.mockRejectedValue({ code: 'file_type_not_allowed', status: 400, message: '' });

      render(<CommentInput requirementId={10} />);
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Ese tipo de archivo no está permitido');
      expect(alert.textContent).not.toMatch(/docx|xlsx|pptx/i);
    });

    it('TS-37: el error de titularidad se muestra como permisos', () => {
      mockUseCreateComment.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: true,
        error: { code: 'file_not_owned', status: 403, message: 'File not owned' },
      });

      render(<CommentInput requirementId={10} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('No podés adjuntar un archivo que subió otra persona');
      expect(alert).not.toHaveTextContent('Sin permiso para comentar');
      expect(alert).not.toHaveTextContent('File not owned');
    });

    it('TS-38: el 403 genérico conserva su mensaje actual', () => {
      mockUseCreateComment.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: true,
        error: { code: 'access_denied', status: 403, message: '' },
      });

      render(<CommentInput requirementId={10} />);

      expect(screen.getByRole('alert')).toHaveTextContent('Sin permiso para comentar');
    });

    it('un archivo no disponible se comunica de forma entendible', () => {
      mockUseCreateComment.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: true,
        error: { code: 'file_not_available', status: 404, message: '' },
      });

      render(<CommentInput requirementId={10} />);

      expect(screen.getByRole('alert')).toHaveTextContent('El archivo no está disponible');
    });

    it('TS-40: el DOM no nombra los límites en ningún estado', async () => {
      mockUploadFile.mockRejectedValue({ code: 'file_type_not_allowed', status: 400, message: '' });

      const { container } = render(<CommentInput requirementId={10} />);
      expect(container.textContent).not.toMatch(/10\s?MB/i);

      fireEvent.change(fileInput(), { target: { files: [bigFile()] } });
      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
      expect(container.textContent).not.toMatch(/10\s?MB/i);
    });

    it('TS-41: la validación de cliente falla rápido, con el mismo mensaje que el servidor', async () => {
      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), { target: { files: [bigFile()] } });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('El archivo supera el tamaño máximo permitido');
      expect(mockUploadFile).not.toHaveBeenCalled();
    });

    it('la validación de cliente rechaza una extensión fuera de lista sin subir', async () => {
      render(<CommentInput requirementId={10} />);

      fireEvent.change(fileInput(), {
        target: { files: [new File(['x'], 'malware.exe', { type: 'application/octet-stream' })] },
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Ese tipo de archivo no está permitido');
      expect(mockUploadFile).not.toHaveBeenCalled();
    });
  });

  describe('viewports', () => {
    it('TS-22 (mobile): el progreso está dentro del editor de comentario', async () => {
      mockUseIsMobile.mockReturnValue(true);
      mockUploadFile.mockImplementation(async (_f: File, onProgress: (p: number) => void) => {
        onProgress(58);
        await new Promise(() => {});
      });

      render(<CommentInput requirementId={10} />);
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      const bar = await screen.findByRole('progressbar');
      expect(bar).toHaveTextContent('Subiendo foto.png... 58%');
      expect(screen.getByTestId('comment-input')).toContainElement(bar);
    });

    it('TS-23 (desktop): el progreso está en la misma posición relativa', async () => {
      mockUseIsMobile.mockReturnValue(false);
      mockUploadFile.mockImplementation(async (_f: File, onProgress: (p: number) => void) => {
        onProgress(58);
        await new Promise(() => {});
      });

      render(<CommentInput requirementId={10} />);
      fireEvent.change(fileInput(), { target: { files: [IMAGE] } });

      const bar = await screen.findByRole('progressbar');
      expect(bar).toHaveTextContent('Subiendo foto.png... 58%');
      expect(screen.getByTestId('comment-input')).toContainElement(bar);
    });
  });
});
