import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAttachmentMeta } from '../../hooks/useAttachmentMeta';
import { AttachmentPlaceholder } from './AttachmentPlaceholder';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

vi.mock('../../hooks/useAttachmentMeta', () => ({
  useAttachmentMeta: vi.fn(),
}));

vi.mock('../../services/attachmentsClientApi', () => ({
  getDownloadUrl: (id: number) => `/api/attachments/${id}/download`,
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('AttachmentPlaceholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra estado loading mientras useAttachmentMeta no resolvió', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentPlaceholder attachmentId={42} />);
    expect(screen.getByTestId('attachment-placeholder-loading')).toBeInTheDocument();
  });

  it('muestra card con nombre completo (con extensión), peso y botón Descargar', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 42, fileName: 'reporte.pdf', fileSize: 204800, mimeType: 'application/pdf' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentPlaceholder attachmentId={42} />);

    expect(screen.getByText('reporte.pdf')).toBeInTheDocument();
    expect(screen.getByText('200 KB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar/i })).toBeInTheDocument();
  });

  it('prefiere fileName de prop sobre el resuelto por el hook', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 5, fileName: 'Adjunto 5', fileSize: 1024, mimeType: 'application/pdf' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentPlaceholder attachmentId={5} fileName="informe-cliente.pdf" />);
    expect(screen.getByText('informe-cliente.pdf')).toBeInTheDocument();
  });

  it('dispara fetch al endpoint de download al hacer click en Descargar', async () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 3, fileName: 'doc.pdf', fileSize: 100, mimeType: 'application/pdf' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['bytes'])),
    } as unknown as Response);

    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();

    render(<AttachmentPlaceholder attachmentId={3} />);

    fireEvent.click(screen.getByRole('button', { name: /descargar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/attachments/3/download');
    });
  });

  it('muestra mensaje cuando el hook reporta 403', () => {
    const forbiddenError = new Error('Forbidden') as Error & { status?: number };
    forbiddenError.status = 403;
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: forbiddenError,
    } as never);

    render(<AttachmentPlaceholder attachmentId={9} />);
    expect(screen.getByText(/permisos/i)).toBeInTheDocument();
  });

  it('muestra mensaje de no disponible cuando el hook reporta error distinto de 403', () => {
    const otherError = new Error('boom') as Error & { status?: number };
    otherError.status = 500;
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: otherError,
    } as never);

    render(<AttachmentPlaceholder attachmentId={99} />);
    expect(screen.getByText(/no disponible/i)).toBeInTheDocument();
    expect(screen.getByText(/99/)).toBeInTheDocument();
  });

  it('con onRemove, muestra solo el botón Eliminar (sin Descargar)', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 42, fileName: 'reporte.pdf', fileSize: 204800, mimeType: 'application/pdf' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);
    const onRemove = vi.fn();

    render(<AttachmentPlaceholder attachmentId={42} onRemove={onRemove} />);

    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descargar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('con onRemove, muestra el peso a la izquierda del botón Eliminar', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 42, fileName: 'reporte.pdf', fileSize: 204800, mimeType: 'application/pdf' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentPlaceholder attachmentId={42} onRemove={vi.fn()} />);

    const removeButton = screen.getByRole('button', { name: /eliminar/i });
    const sizeText = screen.getByText('200 KB');
    // El peso debe estar antes del botón en el DOM (a su izquierda).
    expect(
      sizeText.compareDocumentPosition(removeButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('sin onRemove, muestra el peso a la izquierda del botón Descargar (Actividad)', () => {
    vi.mocked(useAttachmentMeta).mockReturnValue({
      data: { id: 42, fileName: 'reporte.pdf', fileSize: 204800, mimeType: 'application/pdf' },
      isLoading: false,
      isError: false,
      error: null,
    } as never);

    render(<AttachmentPlaceholder attachmentId={42} />);

    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    const downloadButton = screen.getByRole('button', { name: /descargar/i });
    const sizeText = screen.getByText('200 KB');
    expect(
      sizeText.compareDocumentPosition(downloadButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
