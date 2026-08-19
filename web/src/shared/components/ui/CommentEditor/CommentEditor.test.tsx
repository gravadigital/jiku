import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile } from '@/features/attachments/services/attachmentsClientApi';
import * as objectivesModule from '@/features/objectives';
import { CommentEditor } from './CommentEditor';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/objectives', () => ({ createComment: vi.fn() }));
vi.mock('@/features/attachments/services/attachmentsApi', () => ({
  deleteAttachment: vi.fn(),
  listAttachments: vi.fn(() => Promise.resolve([])),
  getAttachmentById: vi.fn(),
  requestUploadTicket: vi.fn(),
}));
vi.mock('@/features/attachments/services/attachmentsClientApi', () => ({
  uploadFile: vi.fn(),
  getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
  getFilePreviewUrl: (id: number) => `/api/files/${id}/preview`,
  getDownloadUrl: (id: number) => `/api/attachments/${id}/download`,
}));

function renderEditor(objectiveId = 10) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommentEditor objectiveId={objectiveId} />
    </QueryClientProvider>
  );
}

function attachFile(file: File) {
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });
}

function typeComment(text: string) {
  const editor = screen.getByRole('textbox', { name: 'Comentario' });
  act(() => {
    editor.textContent = text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(objectivesModule.createComment).mockResolvedValue({} as never);
});

describe('CommentEditor — subida', () => {
  it('CA-1: adjuntar sube con uploadFile, sin mencionar ninguna entidad ni borrador', async () => {
    vi.mocked(uploadFile).mockResolvedValue(555);
    renderEditor();

    const file = new File(['contenido'], 'imagen.png', { type: 'image/png' });
    attachFile(file);

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(uploadFile).mock.calls[0][0]).toBe(file);
  });

  it('TS-18 (S-067): el error de permisos al adjuntar sigue diciendo "a esta tarea"', async () => {
    vi.mocked(uploadFile).mockRejectedValue(new Error('permission denied'));
    renderEditor(1);

    attachFile(new File(['x'], 'imagen.png', { type: 'image/png' }));

    const { toast } = await import('react-toastify');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'No tenés permisos para subir archivos a esta tarea'
      );
    });
  });

  it('TS-42 (CA-1): el bloque de progreso nombra el archivo y declara los atributos ARIA', async () => {
    vi.mocked(uploadFile).mockImplementation((_file, options) => {
      options?.onProgress?.(67);
      return new Promise(() => {});
    });
    renderEditor();

    attachFile(new File(['x'], 'captura.png', { type: 'image/png' }));

    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '67');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('Subiendo captura.png... 67%')).toBeInTheDocument();
  });

  it('TS-41 (CA-1): sin subida no hay progressbar ni texto "Subiendo"', () => {
    renderEditor();

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/Subiendo/)).not.toBeInTheDocument();
  });
});

describe('CommentEditor — CA-14: el envío espera al byte', () => {
  it('TS-37/TS-38: "Guardar" y el botón de adjuntar quedan disabled mientras sube', async () => {
    vi.mocked(uploadFile).mockImplementation((_file, options) => {
      options?.onProgress?.(40);
      return new Promise(() => {});
    });
    renderEditor();

    typeComment('Hola');
    attachFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });
    const attachButton = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Adjuntar'));
    expect(attachButton).toBeDisabled();
  });

  it('TS-44: el botón deshabilitado por la subida explica por qué', async () => {
    vi.mocked(uploadFile).mockImplementation(() => new Promise(() => {}));
    renderEditor();

    typeComment('Hola');
    attachFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      const save = screen.getByRole('button', { name: 'Guardar' });
      const describedBy = save.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy as string)?.textContent).toMatch(/subida en curso/i);
    });
  });

  it('TS-40: al terminar la subida se habilita el envío y el progreso desaparece', async () => {
    let resolveUpload: (id: number) => void = () => {};
    vi.mocked(uploadFile).mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveUpload = resolve;
        })
    );
    renderEditor();

    typeComment('Hola');
    attachFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    await act(async () => {
      resolveUpload(555);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('CommentEditor — CA-5: el payload lleva fileIds', () => {
  it('TS-21: confirmar con un adjunto envía fileIds con el fileId, sin attachmentIds', async () => {
    vi.mocked(uploadFile).mockResolvedValue(555);
    renderEditor();

    attachFile(new File(['contenido'], 'doc.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(uploadFile).toHaveBeenCalled());
    typeComment('listo');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(objectivesModule.createComment).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ visibilityLevel: 'internal', fileIds: [555] })
      );
    });
    const payload = vi.mocked(objectivesModule.createComment).mock.calls[0][1] as unknown as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty('attachmentIds');
    expect(payload.comment).toContain('listo');
    // La URL embebida entra por la ruta de ARCHIVOS: el vínculo todavía no existe.
    expect(payload.comment).toContain('/api/files/555/preview');
    expect(payload.comment).not.toContain('/api/attachments/555/preview');
  });

  it('confirmar sin adjuntos envía fileIds vacío', async () => {
    renderEditor();

    typeComment('Sin adjuntos');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(objectivesModule.createComment).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ visibilityLevel: 'internal', fileIds: [] })
      );
    });
  });

  it('TS-24 (CA-9): el error de titularidad se muestra como permisos', async () => {
    vi.mocked(objectivesModule.createComment).mockRejectedValue({
      code: 'file_not_owned',
      status: 403,
      message: 'File not owned',
    });
    renderEditor();

    typeComment('Hola');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const { toast } = await import('react-toastify');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'No podés adjuntar un archivo que subió otra persona'
      );
    });
    expect(toast.error).not.toHaveBeenCalledWith('File not owned');
  });
});

describe('CommentEditor — quitar un adjunto', () => {
  it('quitar no dispara ningún borrado ni pide confirmación', async () => {
    vi.mocked(uploadFile).mockResolvedValue(555);
    const { deleteAttachment } = await import('@/features/attachments/services/attachmentsApi');
    renderEditor();

    attachFile(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    const remove = await screen.findByRole('button', { name: 'Quitar adjunto' });

    fireEvent.click(remove);

    expect(deleteAttachment).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar adjunto' })).toBeNull();
  });
});
