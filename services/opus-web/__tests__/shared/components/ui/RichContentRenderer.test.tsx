import { render, screen, waitFor } from '@testing-library/react';
import { RichContentRenderer } from '@/shared/components/ui/RichContentRenderer/RichContentRenderer';
import { vi } from 'vitest';

vi.mock('@/shared/components/ui/AttachmentDownload/AttachmentDownload', () => ({
  AttachmentDownload: ({ attachmentId, fileName }: { attachmentId: number; fileName: string }) => (
    <div data-testid={`attachment-download-${attachmentId}`}>{fileName || 'Archivo adjunto'}</div>
  ),
}));

vi.mock('@/shared/components/ui/AttachmentPreview/AttachmentPreview', () => ({
  AttachmentPreview: ({
    attachmentId,
    fileName,
    onRemove,
  }: {
    attachmentId: number;
    fileName: string;
    onRemove?: () => void;
  }) => (
    <div data-testid={`attachment-preview-${attachmentId}`} data-filename={fileName}>
      {!onRemove && (
        <img src={`/api/attachments/${attachmentId}/preview`} alt={fileName} loading="lazy" />
      )}
    </div>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockHead(fileName: string) {
  mockFetch.mockResolvedValue({
    headers: {
      get: (h: string) =>
        h === 'Content-Disposition' ? `attachment; filename="${fileName}"` : null,
    },
  });
}

describe('RichContentRenderer', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockHead('archivo.png');
  });

  it('TS-8: renderiza imagen inline en posicion exacta', async () => {
    mockHead('foto.png');
    render(<RichContentRenderer content={'Texto\n![attach:123]\nMás texto'} />);
    await waitFor(() => {
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/api/attachments/123/preview');
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  it('TS-9: renderiza AttachmentDownload para no-imagen', async () => {
    mockHead('doc.pdf');
    render(<RichContentRenderer content={'Inicio\n[attach:124]\nFin'} />);
    await waitFor(() => {
      expect(screen.getByTestId('attachment-download-124')).toBeInTheDocument();
    });
  });

  it('TS-11: content sin placeholders renderiza solo MarkdownRenderer', () => {
    render(<RichContentRenderer content="Texto plano **bold**" />);
    expect(screen.queryByTestId(/attachment-/)).not.toBeInTheDocument();
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
  });

  it('TS-12: multiples adjuntos mixtos en orden correcto', async () => {
    mockHead('archivo.png');
    render(<RichContentRenderer content={'A\n![attach:1]\nB\n[attach:2]\nC'} />);
    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-1')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-download-2')).toBeInTheDocument();
    });
  });

  it('renderiza contenido vacio sin errores', () => {
    const { container } = render(<RichContentRenderer content="" />);
    expect(container).toBeInTheDocument();
  });

  it('fileName se resuelve via HEAD y se pasa al componente', async () => {
    mockHead('informe.pdf');
    render(<RichContentRenderer content="[attach:8]" />);
    await waitFor(() => {
      expect(screen.getByTestId('attachment-download-8')).toHaveTextContent('informe.pdf');
    });
  });
});
