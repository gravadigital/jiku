import { render, screen } from '@testing-library/react';
import { DocumentAttachments } from './DocumentAttachments';

const DOC_ID = '01JC7Z4X9QH2M5N8R3T6V0W1YA';
const OTHER_DOC_ID = '01JC7Z6C3M9E5G7H1J2K4N6P8Q';
const ATT_ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';
const attachment = {
  id: ATT_ID,
  documentId: DOC_ID,
  fileName: 'diagrama.png',
  link: 'https://jiku.acme.io/docs/attachments/01JC7Z5B2K8D4F6G0H1J3K5M7N',
};

describe('DocumentAttachments', () => {
  it('TS-23: un enlace por adjunto hacia el proxy del documento, en pestaña nueva', () => {
    render(<DocumentAttachments documentId={DOC_ID} attachments={[attachment]} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Adjuntos' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'diagrama.png' });
    expect(link).toHaveAttribute('href', `/api/docs/documents/${DOC_ID}/attachments/${ATT_ID}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('TS-24: sin documentId en el adjunto usa el del documento abierto', () => {
    render(
      <DocumentAttachments
        documentId={DOC_ID}
        attachments={[{ id: ATT_ID, fileName: 'diagrama.png' }]}
      />
    );
    expect(screen.getByRole('link', { name: 'diagrama.png' })).toHaveAttribute(
      'href',
      `/api/docs/documents/${DOC_ID}/attachments/${ATT_ID}`
    );
  });

  it('TS-25: el documentId del adjunto gana sobre la prop', () => {
    render(
      <DocumentAttachments
        documentId={DOC_ID}
        attachments={[{ id: ATT_ID, documentId: OTHER_DOC_ID, fileName: 'diagrama.png' }]}
      />
    );
    expect(screen.getByRole('link', { name: 'diagrama.png' })).toHaveAttribute(
      'href',
      `/api/docs/documents/${OTHER_DOC_ID}/attachments/${ATT_ID}`
    );
  });

  it('TS-26: sin adjuntos no renderiza nada', () => {
    const { container, rerender } = render(
      <DocumentAttachments documentId={DOC_ID} attachments={[]} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<DocumentAttachments documentId={DOC_ID} />);
    expect(container).toBeEmptyDOMElement();
  });
});
