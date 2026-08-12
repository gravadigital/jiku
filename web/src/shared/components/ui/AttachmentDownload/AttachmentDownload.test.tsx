import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AttachmentDownload } from './AttachmentDownload';

describe('AttachmentDownload', () => {
  it('muestra el nombre y tamaño del archivo', () => {
    render(
      <AttachmentDownload
        attachmentId={1}
        fileName="reporte.pdf"
        fileSize={204800}
        mimeType="application/pdf"
      />
    );
    expect(screen.getByText('reporte.pdf')).toBeInTheDocument();
    expect(screen.getByText('200 KB')).toBeInTheDocument();
  });

  it('muestra un ícono distinto para PDF que para Word según mimeType', () => {
    const { container: pdfContainer } = render(
      <AttachmentDownload attachmentId={1} fileName="reporte.pdf" mimeType="application/pdf" />
    );
    const { container: wordContainer } = render(
      <AttachmentDownload
        attachmentId={2}
        fileName="doc.docx"
        mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      />
    );

    const pdfIconHtml = pdfContainer.querySelector('[class*="iconWrap"]')?.innerHTML;
    const wordIconHtml = wordContainer.querySelector('[class*="iconWrap"]')?.innerHTML;

    expect(pdfIconHtml).toBeTruthy();
    expect(wordIconHtml).toBeTruthy();
    expect(pdfIconHtml).not.toBe(wordIconHtml);
  });

  it('sin mimeType, cae al ícono genérico de documento (compatibilidad hacia atrás)', () => {
    const { container } = render(<AttachmentDownload attachmentId={1} fileName="archivo" />);
    expect(container.querySelector('[class*="iconWrap"] svg')).toBeInTheDocument();
  });
});
