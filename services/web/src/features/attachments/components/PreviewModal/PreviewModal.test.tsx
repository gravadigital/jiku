import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewModal } from './PreviewModal';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

const pdf = { id: 42, fileName: 'roto.pdf', mimeType: 'application/pdf' };
const image = { id: 43, fileName: 'foto.png', mimeType: 'image/png' };

function mockFetch(status: number) {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
    } as Response)
  ) as typeof global.fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = vi.fn();
});

describe('PreviewModal — O-01 con archivo no disponible', () => {
  it('TS-31: un PDF no disponible muestra el mensaje y NO renderiza un iframe', async () => {
    mockFetch(404);
    render(<PreviewModal attachment={pdf} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('El archivo no está disponible')).toBeInTheDocument();
    });
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('TS-31: una imagen no disponible muestra el mensaje y NO renderiza un img', async () => {
    mockFetch(404);
    render(<PreviewModal attachment={image} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('El archivo no está disponible')).toBeInTheDocument();
    });
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('TS-32: un 403 sigue diciendo permisos, no "no disponible"', async () => {
    mockFetch(403);
    render(<PreviewModal attachment={image} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText('No tenés permisos para visualizar este archivo')
      ).toBeInTheDocument();
    });
    expect(screen.queryByText('El archivo no está disponible')).not.toBeInTheDocument();
  });

  it('un PDF disponible sí renderiza el iframe', async () => {
    mockFetch(200);
    render(<PreviewModal attachment={pdf} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(document.querySelector('iframe')).not.toBeNull();
    });
    expect(screen.queryByText('El archivo no está disponible')).not.toBeInTheDocument();
  });

  it('una imagen disponible sí renderiza el img', async () => {
    mockFetch(200);
    render(<PreviewModal attachment={image} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(document.querySelector('img')).not.toBeNull();
    });
  });
});
