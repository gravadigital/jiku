import { render, screen, waitFor } from '@testing-library/react';
import { RichContentRenderer } from './RichContentRenderer';
import { vi } from 'vitest';

vi.mock('../AttachmentPreview/AttachmentPreview', () => ({
  AttachmentPreview: ({ attachmentId, fileName }: { attachmentId: number; fileName: string }) => (
    <div data-testid={`attachment-preview-${attachmentId}`} data-filename={fileName} />
  ),
}));

vi.mock('../AttachmentDownload/AttachmentDownload', () => ({
  AttachmentDownload: ({ attachmentId, fileName }: { attachmentId: number; fileName: string }) => (
    <div data-testid={`attachment-download-${attachmentId}`} data-filename={fileName} />
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
});
