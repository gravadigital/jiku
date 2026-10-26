import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentAttachments } from './DocumentAttachments';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

const ATT = {
  id: '01J9Z3K8M2Q4R6T8V0W2Y4A6E0',
  documentId: 'D',
  fileName: 'diagrama.png',
  mimeType: 'image/png',
  sizeBytes: 1,
  link: 'x',
  uploadedBy: 'u',
  createdAt: '2026-10-02T10:00:00.000Z',
};

describe('DocumentAttachments (TS-25)', () => {
  it('título con la cantidad y enlace al adjunto', () => {
    render(<DocumentAttachments attachments={[ATT]} />);
    expect(screen.getByRole('heading', { name: 'Adjuntos (1)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'diagrama.png' })).toHaveAttribute(
      'href',
      '/docs/attachments/01J9Z3K8M2Q4R6T8V0W2Y4A6E0'
    );
  });
  it('vacío', () => {
    render(<DocumentAttachments attachments={[]} />);
    expect(screen.getByRole('heading', { name: 'Adjuntos' })).toBeInTheDocument();
    expect(screen.getByText('Sin adjuntos.')).toBeInTheDocument();
  });
});
