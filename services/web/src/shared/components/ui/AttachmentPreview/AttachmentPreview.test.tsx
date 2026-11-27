import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('usa la ruta de files cuando el recurso es un archivo sin vínculo', () => {
    render(
      <AttachmentPreview
        attachmentId={252}
        resource="file"
        fileName="messi.png"
        mimeType="image/png"
      />
    );
    expect(screen.getByAltText('messi.png')).toHaveAttribute(
      'src',
      '/api/files/252/preview'
    );
  });

  it('muestra el mensaje de no disponible cuando la imagen falla', () => {
    render(
      <AttachmentPreview attachmentId={5} fileName="roto.png" mimeType="image/png" />
    );
    fireEvent.error(screen.getByAltText('roto.png'));
    expect(screen.getByText('El archivo no está disponible')).toBeInTheDocument();
  });

  /**
   * El fallo se recordaba PARA SIEMPRE: `failed` es estado local y nada lo reseteaba, así que
   * al cambiar de adjunto —un id nuevo en el mismo nodo del editor— el componente seguía
   * mostrando "El archivo no está disponible" del anterior, aunque el nuevo estuviera bien.
   */
  it('olvida el fallo anterior cuando cambia el adjunto', () => {
    const { rerender } = render(
      <AttachmentPreview attachmentId={5} fileName="roto.png" mimeType="image/png" />
    );
    fireEvent.error(screen.getByAltText('roto.png'));
    expect(screen.getByText('El archivo no está disponible')).toBeInTheDocument();

    rerender(
      <AttachmentPreview attachmentId={6} fileName="buena.png" mimeType="image/png" />
    );

    expect(screen.queryByText('El archivo no está disponible')).not.toBeInTheDocument();
    expect(screen.getByAltText('buena.png')).toBeInTheDocument();
  });
});
