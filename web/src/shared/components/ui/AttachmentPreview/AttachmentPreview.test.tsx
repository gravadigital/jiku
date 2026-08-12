import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AttachmentPreview } from './AttachmentPreview';

describe('AttachmentPreview', () => {
  it('muestra el peso del archivo cuando se provee fileSize', () => {
    render(
      <AttachmentPreview
        attachmentId={1}
        fileName="foto.png"
        mimeType="image/png"
        fileSize={204800}
      />
    );
    expect(screen.getByText((_, el) => el?.textContent === ' · 200 KB')).toBeInTheDocument();
  });

  it('formatea tamaños grandes en MB', () => {
    render(
      <AttachmentPreview
        attachmentId={1}
        fileName="foto.png"
        mimeType="image/png"
        fileSize={2 * 1024 * 1024}
      />
    );
    expect(screen.getByText((_, el) => el?.textContent === ' · 2.0 MB')).toBeInTheDocument();
  });

  it('sin fileSize, no muestra el peso', () => {
    render(<AttachmentPreview attachmentId={1} fileName="foto.png" mimeType="image/png" />);
    expect(screen.queryByText(/KB|MB/)).not.toBeInTheDocument();
  });

  it('muestra el nombre del archivo', () => {
    render(
      <AttachmentPreview
        attachmentId={1}
        fileName="foto.png"
        mimeType="image/png"
        fileSize={1024}
      />
    );
    expect(screen.getByText('foto.png')).toBeInTheDocument();
  });
});
