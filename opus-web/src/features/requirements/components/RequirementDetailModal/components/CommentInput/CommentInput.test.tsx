import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentInput } from './CommentInput';
import { vi } from 'vitest';

const mockUploadFile = vi.fn();
const mockMutate = vi.fn();

vi.mock('@/features/attachments/services/attachmentsApi', () => ({
  attachmentsApi: {
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
    getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
  },
}));

vi.mock('@/features/comments/hooks/useCreateComment', () => ({
  useCreateComment: () => ({ mutate: mockMutate, isPending: false, isError: false, error: null }),
}));

vi.mock('@/shared/components/ui/RichTextEditor/RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  ),
}));

describe('CommentInput — Tarea 6: integración RichTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza RichTextEditor (no textarea nativo)', () => {
    render(<CommentInput requirementId={10} />);
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('NO renderiza div.attachPreviews separado', () => {
    render(<CommentInput requirementId={10} />);
    expect(document.querySelector('.attachPreviews')).not.toBeInTheDocument();
  });

  it('tras upload, llama uploadFile con requirement_comment_draft y requirementId', async () => {
    mockUploadFile.mockResolvedValue([
      { id: 5, fileName: 'foto.png', mimeType: 'image/png', fileSize: 1024 },
    ]);

    render(<CommentInput requirementId={10} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());
    expect(mockUploadFile).toHaveBeenCalledWith('requirement_comment_draft', 10, file);
  });

  it('eliminar adjunto (onChange sin el placeholder) sincroniza pendingAttachments y excluye el ID del submit', async () => {
    mockUploadFile.mockResolvedValue([
      { id: 5, fileName: 'foto.png', mimeType: 'image/png', fileSize: 1024 },
    ]);

    render(<CommentInput requirementId={10} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

    const editor = screen.getByTestId('rich-text-editor');
    fireEvent.change(editor, { target: { value: 'texto sin attach' } });

    const sendBtn = screen.getByLabelText('Enviar comentario');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentIds: [] }),
        expect.anything()
      );
    });
  });

  it('botón enviar deshabilitado cuando el editor está vacío', () => {
    render(<CommentInput requirementId={10} />);
    expect(screen.getByLabelText('Enviar comentario')).toBeDisabled();
  });
});
