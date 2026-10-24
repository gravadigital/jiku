import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUploadDocAttachment } from '../../hooks/useUploadDocAttachment';
import { DocumentAttachZone } from './DocumentAttachZone';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../hooks/useUploadDocAttachment', () => ({ useUploadDocAttachment: vi.fn() }));

const DOC = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const LINK = 'https://jiku.example.com/docs/attachments/01J9Z3K8M2Q4R6T8V0W2Y4A6D1';
const mutate = vi.fn();

const setUpload = (over: Record<string, unknown> = {}) =>
  vi.mocked(useUploadDocAttachment).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
    ...over,
  } as never);

const drop = (file: File) =>
  fireEvent.change(document.querySelector('input[type=file]') as HTMLInputElement, {
    target: { files: [file] },
  });

describe('DocumentAttachZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUpload();
  });

  it('TS-96: de a un archivo por vez', () => {
    render(<DocumentAttachZone documentId={DOC} onUploaded={vi.fn()} />);
    expect(document.querySelector('input[type=file]')).not.toHaveAttribute('multiple');
  });

  it('sube el archivo y entrega el markdown al terminar', async () => {
    const onUploaded = vi.fn();
    mutate.mockImplementation((_file, options) =>
      options.onSuccess({
        id: 'D1',
        fileName: 'diagrama.png',
        mimeType: 'image/png',
        link: LINK,
      })
    );
    render(<DocumentAttachZone documentId={DOC} onUploaded={onUploaded} />);
    drop(new File(['x'], 'diagrama.png', { type: 'image/png' }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(`![diagrama.png](${LINK})`));
  });

  it('TS-93: mientras sube muestra el nombre en una región aria-live', () => {
    setUpload({ isPending: true });
    const { rerender } = render(<DocumentAttachZone documentId={DOC} onUploaded={vi.fn()} />);
    // El nombre se conoce al soltar el archivo: se simula con el estado previo de subida.
    setUpload();
    rerender(<DocumentAttachZone documentId={DOC} onUploaded={vi.fn()} />);
    drop(new File(['x'], 'diagrama.png', { type: 'image/png' }));
    setUpload({ isPending: true });
    rerender(<DocumentAttachZone documentId={DOC} onUploaded={vi.fn()} />);
    expect(screen.getByText('Subiendo diagrama.png…', { selector: 'p' })).toHaveAttribute(
      'aria-live',
      'polite'
    );
  });

  it.each([
    ['attachment_type_not_allowed', 'Ese tipo de archivo no está permitido.'],
    ['attachment_too_large', 'El archivo supera el tamaño máximo permitido.'],
    ['expired_upload_url', 'No se pudo adjuntar el archivo. Intentá de nuevo.'],
    ['attachments_not_configured', 'No se pudo adjuntar el archivo. Intentá de nuevo.'],
  ])('TS-95: error %s', (code, message) => {
    setUpload({ isError: true, error: { code, message: 'x', status: 400 } });
    render(<DocumentAttachZone documentId={DOC} onUploaded={vi.fn()} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
