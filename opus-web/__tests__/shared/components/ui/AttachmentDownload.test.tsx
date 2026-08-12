import { render, screen } from '@testing-library/react';
import { AttachmentDownload } from '@/shared/components/ui/AttachmentDownload/AttachmentDownload';

describe('AttachmentDownload', () => {
  it('renderiza el fileName', () => {
    render(<AttachmentDownload attachmentId={124} fileName="doc.pdf" />);
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
  });

  it('renderiza un link con href a /api/attachments/{id}/preview', () => {
    render(<AttachmentDownload attachmentId={124} fileName="doc.pdf" />);
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/api/attachments/124/preview')).toBe(true);
  });

  it('renderiza "Archivo adjunto" cuando fileName esta vacio', () => {
    render(<AttachmentDownload attachmentId={99} fileName="" />);
    expect(screen.getByText('Archivo adjunto')).toBeInTheDocument();
  });
});
