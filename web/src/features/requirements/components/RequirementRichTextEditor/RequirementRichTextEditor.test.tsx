import React, { useRef } from 'react';
import { fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile } from '@/features/attachments/services/attachmentsClientApi';
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
  uploadFile: vi.fn(),
  getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
  getFilePreviewUrl: (id: number) => `/api/files/${id}/preview`,
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

  it('sube con uploadFile y emite un placeholder [file:N] con el fileId', async () => {
    vi.mocked(uploadFile).mockResolvedValue(1234);
    const onChange = vi.fn();
    render(<Harness onReady={() => {}} onChange={onChange} />);
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(uploadFile).mock.calls[0][0]).toBe(file);
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('![file:1234]'));
    });
    // No usa el espacio de ids de vinculos para un archivo sin vincular.
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('attach:1234'));
  });

  it('un archivo que no es imagen emite [file:N] sin el bang', async () => {
    vi.mocked(uploadFile).mockResolvedValue(99);
    const onChange = vi.fn();
    render(<Harness onReady={() => {}} onChange={onChange} />);
    const file = new File(['contenido'], 'informe.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('[file:99]'));
    });
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('![file:99]'));
  });

  it('avisa que hay una subida en curso y cuando termina', async () => {
    let resolveUpload: (id: number) => void = () => {};
    vi.mocked(uploadFile).mockImplementation(
      () => new Promise<number>((resolve) => {
        resolveUpload = resolve;
      })
    );
    const onUploadingChange = vi.fn();
    render(
      <RequirementRichTextEditor onUploadingChange={onUploadingChange} />
    );
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onUploadingChange).toHaveBeenCalledWith(true);
    });

    await act(async () => {
      resolveUpload(7);
    });

    await waitFor(() => {
      expect(onUploadingChange).toHaveBeenLastCalledWith(false);
    });
  });

  it('reporta el progreso real del archivo en curso', async () => {
    vi.mocked(uploadFile).mockImplementation(async (_file, options) => {
      options?.onProgress?.(42);
      return 1;
    });
    const onUploadProgress = vi.fn();
    render(<RequirementRichTextEditor onUploadProgress={onUploadProgress} />);
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onUploadProgress).toHaveBeenCalledWith(42, 'foto.png');
    });
  });
});
