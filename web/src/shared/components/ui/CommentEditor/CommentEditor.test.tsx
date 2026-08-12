import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useUploadAttachmentModule from '@/features/attachments/hooks/useUploadAttachment';
import * as objectivesModule from '@/features/objectives';
import { CommentEditor } from './CommentEditor';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/objectives', () => ({ createComment: vi.fn() }));
vi.mock('@/features/attachments/hooks/useUploadAttachment');

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe('CommentEditor', () => {
  it('TS-18 (S-067): error de permisos al adjuntar muestra "...a esta tarea"', async () => {
    vi.mocked(useUploadAttachmentModule.useUploadAttachment).mockImplementation((options?: any) => {
      options?.onError?.(new Error('permission denied'));
      return { mutate: vi.fn(), isPending: false } as any;
    });

    render(<CommentEditor objectiveId={1} />);

    const { toast } = await import('react-toastify');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'No tenés permisos para subir archivos a esta tarea'
      );
    });
  });

  it('S-095/TS-3: adjuntar un archivo sube con entityType objective_comment_draft y entityId=objectiveId', () => {
    const mockUpload = vi.fn();
    vi.mocked(useUploadAttachmentModule.useUploadAttachment).mockReturnValue({
      mutate: mockUpload,
      isPending: false,
    } as any);

    render(<CommentEditor objectiveId={10} />);

    const file = new File(['contenido'], 'imagen.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockUpload).toHaveBeenCalledWith(
      { entityType: 'objective_comment_draft', entityId: 10, files: [file] },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('S-095/TS-4: confirmar el comentario con un adjunto envía attachmentIds', async () => {
    const mockUpload = vi.fn((_vars: any, options: any) => {
      options?.onSuccess?.([{ id: 55, fileName: 'doc.pdf', mimeType: 'application/pdf' }]);
    });
    vi.mocked(useUploadAttachmentModule.useUploadAttachment).mockReturnValue({
      mutate: mockUpload,
      isPending: false,
    } as any);
    vi.mocked(objectivesModule.createComment).mockResolvedValue({} as any);

    renderWithQueryClient(<CommentEditor objectiveId={10} />);

    const file = new File(['contenido'], 'doc.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const editor = screen.getByRole('textbox', { name: 'Comentario' });
    act(() => {
      editor.textContent = 'Hola';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(objectivesModule.createComment).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ visibilityLevel: 'internal', attachmentIds: [55] })
      );
    });
  });

  it('S-095/TS-5: confirmar el comentario sin adjuntos envía attachmentIds vacío', async () => {
    vi.mocked(useUploadAttachmentModule.useUploadAttachment).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(objectivesModule.createComment).mockResolvedValue({} as any);

    render(<CommentEditor objectiveId={10} />);

    const editor = screen.getByRole('textbox', { name: 'Comentario' });
    act(() => {
      editor.textContent = 'Sin adjuntos';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(objectivesModule.createComment).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ visibilityLevel: 'internal', attachmentIds: [] })
      );
    });
  });
});
