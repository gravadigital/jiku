import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAttachmentMeta } from '../../hooks/useAttachmentMeta';
import { AttachmentImagePreview } from './AttachmentImagePreview';

vi.mock('../../hooks/useAttachmentMeta', () => ({
  useAttachmentMeta: vi.fn(),
}));

vi.mock('../../services/attachmentsClientApi', () => ({
  getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
  getDownloadUrl: (id: number) => `/api/attachments/${id}/download`,
}));

describe('AttachmentImagePreview', () => {
  it('muestra estado de carga mientras se resuelve la metadata', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentImagePreview attachmentId={7} />);
    expect(screen.getByTestId('attachment-image-preview-loading')).toBeInTheDocument();
  });

  it('muestra mensaje de error cuando falla la resolución de metadata', () => {
    const forbiddenError = new Error('Forbidden') as Error & { status?: number };
    forbiddenError.status = 403;
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: forbiddenError,
    } as never);

    render(<AttachmentImagePreview attachmentId={7} />);
    expect(screen.getByText(/permisos/i)).toBeInTheDocument();
  });

  it('renderiza AttachmentPreview con la metadata resuelta, incluyendo el botón de descarga (sin onRemove)', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 7, fileName: 'foto.jpg', fileSize: 204800, mimeType: 'image/jpeg' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentImagePreview attachmentId={7} />);

    const img = screen.getByRole('img', { name: 'foto.jpg' });
    expect(img).toHaveAttribute('src', '/api/attachments/7/preview');
    expect(screen.getByRole('link', { name: /descargar adjunto/i })).toHaveAttribute(
      'href',
      '/api/attachments/7/preview'
    );
  });

  it('prefiere fileName de prop sobre el resuelto por el hook', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 5, fileName: 'Adjunto 5', fileSize: 1024, mimeType: 'image/png' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentImagePreview attachmentId={5} fileName="foto-cliente.png" />);
    expect(screen.getByRole('img', { name: 'foto-cliente.png' })).toBeInTheDocument();
  });
});
