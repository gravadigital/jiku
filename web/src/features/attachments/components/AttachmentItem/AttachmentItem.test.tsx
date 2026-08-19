import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAttachment } from '../../services/attachmentsApi';
import { AttachmentItem } from './AttachmentItem';
import type { Attachment } from '../../types/attachment.types';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/attachmentsApi', () => ({
  deleteAttachment: vi.fn(() => Promise.resolve()),
  listAttachments: vi.fn(() => Promise.resolve([])),
  getAttachmentById: vi.fn(),
  requestUploadTicket: vi.fn(),
}));

const attachment: Attachment = {
  id: 42,
  fileId: 4200,
  entityType: 'project',
  entityId: 1,
  fileName: 'roto.pdf',
  fileSize: 4194304,
  mimeType: 'application/pdf',
  storageKey: 'f/abc.pdf',
  uploadedBy: 'u1',
  description: null,
  createdAt: '2026-08-19T10:00:00.000Z',
  uploader: { id: 'u1', name: 'Lautaro', email: 'l@example.com' },
};

function renderItem(canDelete = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AttachmentItem attachment={attachment} onPreview={vi.fn()} canDelete={canDelete} />
    </QueryClientProvider>
  );
}

function mockHead(status: number) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="roto.pdf"',
      }),
    } as Response)
  ) as typeof global.fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AttachmentItem — variante "archivo no disponible"', () => {
  it('TS-29: el item sigue en la lista, muestra el mensaje, con Preview/Download disabled', async () => {
    mockHead(404);
    renderItem();

    await waitFor(() => {
      expect(screen.getByText('El archivo no está disponible')).toBeInTheDocument();
    });
    // El nombre se sigue mostrando: el adjunto no se saca de la lista.
    expect(screen.getByTitle('roto.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
    // Eliminar sigue habilitado: es la única salida útil.
    expect(screen.getByRole('button', { name: 'Eliminar' })).not.toBeDisabled();
  });

  it('TS-29: el estado se comunica con texto, no solo con color', async () => {
    mockHead(404);
    renderItem();

    const message = await screen.findByText('El archivo no está disponible');
    expect(message).toHaveAttribute('role', 'alert');
  });

  it('TS-30: el adjunto no disponible se puede borrar', async () => {
    const user = userEvent.setup();
    mockHead(404);
    renderItem();

    await screen.findByText('El archivo no está disponible');
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(deleteAttachment).toHaveBeenCalledWith(42);
    });
  });

  it('un adjunto disponible no muestra el mensaje y mantiene las acciones', async () => {
    mockHead(200);
    renderItem();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download' })).not.toBeDisabled();
    });
    expect(screen.queryByText('El archivo no está disponible')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).not.toBeDisabled();
  });

  it('un 403 NO se muestra como "archivo no disponible"', async () => {
    mockHead(403);
    renderItem();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preview' })).not.toBeDisabled();
    });
    expect(screen.queryByText('El archivo no está disponible')).not.toBeInTheDocument();
  });
});
