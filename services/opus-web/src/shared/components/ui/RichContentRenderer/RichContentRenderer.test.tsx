import { render, screen, waitFor } from '@testing-library/react';
import { RichContentRenderer } from './RichContentRenderer';
import { vi } from 'vitest';

vi.mock('../AttachmentPreview/AttachmentPreview', () => ({
  AttachmentPreview: ({
    attachmentId,
    fileName,
    previewUrl,
  }: {
    attachmentId: number;
    fileName: string;
    previewUrl?: string;
  }) => (
    <div
      data-testid={`attachment-preview-${attachmentId}`}
      data-filename={fileName}
      data-preview-url={previewUrl}
    />
  ),
}));

vi.mock('../AttachmentDownload/AttachmentDownload', () => ({
  AttachmentDownload: ({
    attachmentId,
    fileName,
    resource,
  }: {
    attachmentId: number;
    fileName: string;
    resource?: string;
  }) => (
    <div
      data-testid={`attachment-download-${attachmentId}`}
      data-filename={fileName}
      data-resource={resource ?? 'attachment'}
    />
  ),
}));

vi.mock('../MarkdownRenderer/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockHeadResponse(fileName: string) {
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
    mockHeadResponse('archivo.png');
  });

  it('content vacío renderiza div vacío', () => {
    const { container } = render(<RichContentRenderer content="" />);
    expect(container.querySelector('[data-testid="markdown-content"]')).toBeInTheDocument();
  });

  it('content sin placeholders pasa directo a MarkdownRenderer', () => {
    render(<RichContentRenderer content="Texto sin placeholders" />);
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('Texto sin placeholders');
    expect(screen.queryByTestId(/attachment-/)).not.toBeInTheDocument();
  });

  it('![attach:3] renderiza AttachmentPreview con attachmentId=3', async () => {
    mockHeadResponse('foto.png');
    render(<RichContentRenderer content="![attach:3]" />);
    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-3')).toBeInTheDocument();
    });
  });

  it('[attach:8] renderiza AttachmentDownload con attachmentId=8', async () => {
    mockHeadResponse('doc.pdf');
    render(<RichContentRenderer content="[attach:8]" />);
    await waitFor(() => {
      expect(screen.getByTestId('attachment-download-8')).toBeInTheDocument();
    });
  });

  it('contenido mixto renderiza segmentos en orden', async () => {
    render(<RichContentRenderer content={'Texto\n![attach:3]\nmás texto'} />);
    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-3')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('markdown-content').length).toBeGreaterThanOrEqual(1);
  });

  it('fileName se resuelve via HEAD y se pasa al componente', async () => {
    mockHeadResponse('informe.pdf');
    render(<RichContentRenderer content="[attach:8]" />);
    await waitFor(() => {
      const el = screen.getByTestId('attachment-download-8');
      expect(el).toHaveAttribute('data-filename', 'informe.pdf');
    });
  });

  /**
   * EL BUG: `web` guarda los adjuntos como `file:N` (id de `files`) y este renderer solo
   * conocía `attach:N`, así que el comentario se mostraba con el placeholder CRUDO como texto
   * —"Prueba público![file:257]"— y el archivo nunca cargaba.
   *
   * Los dos prefijos tienen que coexistir: son dos espacios de ids distintos y los dos
   * frontends leen los mismos comentarios.
   */
  it('![file:257] renderiza la imagen por la ruta de FILES, no como texto crudo', async () => {
    mockHeadResponse('captura.png');
    render(<RichContentRenderer content="Prueba público![file:257]" />);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-257')).toBeInTheDocument();
    });
    expect(screen.getByTestId('attachment-preview-257')).toHaveAttribute(
      'data-preview-url',
      '/api/files/257/preview'
    );
    // El placeholder no puede quedar visible en ningún segmento de texto.
    screen.queryAllByTestId('markdown-content').forEach((el) => {
      expect(el.textContent).not.toContain('[file:257]');
    });
  });

  it('[file:258] renderiza la descarga marcada como recurso de archivo', async () => {
    mockHeadResponse('manual.pdf');
    render(<RichContentRenderer content="Ahora con pdf[file:258]" />);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-download-258')).toBeInTheDocument();
    });
    expect(screen.getByTestId('attachment-download-258')).toHaveAttribute('data-resource', 'file');
  });

  it('resuelve los metadatos de un `file:` contra la ruta de files', async () => {
    mockHeadResponse('captura.png');
    render(<RichContentRenderer content="![file:257]" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/files/257/preview', { method: 'HEAD' });
    });
  });

  it('sigue soportando `attach:` — los dos espacios coexisten', async () => {
    mockHeadResponse('foto.png');
    render(<RichContentRenderer content="![attach:3]" />);

    await waitFor(() => {
      expect(screen.getByTestId('attachment-preview-3')).toBeInTheDocument();
    });
    expect(screen.getByTestId('attachment-preview-3')).toHaveAttribute(
      'data-preview-url',
      '/api/attachments/3/preview'
    );
  });
});
