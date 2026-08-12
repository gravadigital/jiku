import React, { useRef } from 'react';
import { fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadAttachments } from '@/features/attachments/services/attachmentsClientApi';
import {
  RequirementRichTextEditor,
  type RequirementRichTextEditorHandle,
} from './RequirementRichTextEditor';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock('@/features/attachments/services/attachmentsClientApi', () => ({
  uploadAttachments: vi.fn(),
  getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
  getDownloadUrl: (id: number) => `/api/attachments/${id}/download`,
}));
vi.mock('@/features/attachments/utils/fileValidation', () => ({
  validateFile: vi.fn(() => ({ valid: true })),
}));

interface HarnessProps {
  readonly onChange?: (v: string) => void;
  readonly onUploadError?: (e: string) => void;
  readonly onReady: (handle: RequirementRichTextEditorHandle) => void;
}

function Harness({ onChange, onUploadError, onReady }: HarnessProps) {
  const ref = useRef<RequirementRichTextEditorHandle>(null);
  const setRef = (h: RequirementRichTextEditorHandle | null) => {
    (ref as React.MutableRefObject<RequirementRichTextEditorHandle | null>).current = h;
    if (h) onReady(h);
  };
  return (
    <RequirementRichTextEditor
      ref={setRef}
      ariaLabel="Contexto"
      placeholder="Describe el requisito..."
      onChange={onChange}
      onUploadError={onUploadError}
    />
  );
}

function renderEditor(
  opts: {
    onChange?: (v: string) => void;
    onUploadError?: (e: string) => void;
  } = {}
): { handle: RequirementRichTextEditorHandle } {
  let captured: RequirementRichTextEditorHandle | null = null;
  render(
    <Harness
      {...opts}
      onReady={(h) => {
        captured = h;
      }}
    />
  );
  if (!captured) throw new Error('Editor handle not captured');
  return { handle: captured };
}

describe('RequirementRichTextEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el área de texto con placeholder', () => {
    renderEditor();
    expect(screen.getByPlaceholderText('Describe el requisito...')).toBeInTheDocument();
  });

  it('getValue retorna string vacío inicialmente', () => {
    const { handle } = renderEditor();
    expect(handle.getValue()).toBe('');
  });

  it('clear limpia el valor', () => {
    const { handle } = renderEditor();
    act(() => {
      handle.clear();
    });
    expect(handle.getValue()).toBe('');
  });

  it('renderiza el botón de adjuntar', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Adjuntar archivo' })).toBeInTheDocument();
  });

  it('el botón de adjuntar es type=button', () => {
    renderEditor();
    const btn = screen.getByRole('button', { name: 'Adjuntar archivo' });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('por defecto sube con entityType requirement_draft y entityId null', async () => {
    vi.mocked(uploadAttachments).mockResolvedValue([
      {
        id: 1,
        entityType: 'requirement_draft',
        entityId: 0,
        fileName: 'foto.png',
        fileSize: 100,
        mimeType: 'image/png',
        storageKey: '',
        uploadedBy: '',
        description: null,
        createdAt: '',
        uploader: { id: '', name: '', email: '' },
      },
    ]);
    renderEditor();
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadAttachments).toHaveBeenCalledWith('requirement_draft', null, [file]);
    });
  });

  it('con entityType/entityId parametrizados, sube con esos valores', async () => {
    vi.mocked(uploadAttachments).mockResolvedValue([
      {
        id: 1,
        entityType: 'comment_draft',
        entityId: 12,
        fileName: 'foto.png',
        fileSize: 100,
        mimeType: 'image/png',
        storageKey: '',
        uploadedBy: '',
        description: null,
        createdAt: '',
        uploader: { id: '', name: '', email: '' },
      },
    ]);
    let captured: RequirementRichTextEditorHandle | null = null;
    render(
      <RequirementRichTextEditor
        ref={(h) => {
          captured = h;
        }}
        entityType="comment_draft"
        entityId={12}
      />
    );
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadAttachments).toHaveBeenCalledWith('comment_draft', 12, [file]);
    });
    expect(captured).not.toBeNull();
  });
});
