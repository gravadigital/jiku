import { render, screen } from '@testing-library/react';
import { DocumentAttachments } from './DocumentAttachments';

const ATT_ID = '01JC7Z5B2K8D4F6G0H1J3K5M7N';
const attachment = {
  id: ATT_ID,
  fileName: 'diagrama.png',
  link: 'https://jiku.acme.io/docs/attachments/01JC7Z5B2K8D4F6G0H1J3K5M7N',
};

describe('DocumentAttachments', () => {
  it('TS-49: un enlace por adjunto hacia el proxy, en pestaña nueva', () => {
    render(<DocumentAttachments attachments={[attachment]} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Adjuntos' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'diagrama.png' });
    expect(link).toHaveAttribute('href', `/api/docs/attachments/${ATT_ID}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('TS-50: sin adjuntos no renderiza nada', () => {
    const { container, rerender } = render(<DocumentAttachments attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DocumentAttachments />);
    expect(container).toBeEmptyDOMElement();
  });
});
