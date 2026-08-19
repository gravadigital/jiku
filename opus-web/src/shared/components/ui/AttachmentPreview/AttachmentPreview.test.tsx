import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentPreview } from './AttachmentPreview';
import { vi } from 'vitest';

const baseProps = {
  attachmentId: 5,
  fileName: 'foto.png',
  previewUrl: '/api/attachments/5/preview',
  mimeType: 'image/png',
};

describe('AttachmentPreview', () => {
  describe('modo redacción (con onRemove)', () => {
    it('renderiza botón × visible', () => {
      const onRemove = vi.fn();
      render(<AttachmentPreview {...baseProps} onRemove={onRemove} />);
      expect(screen.getByLabelText('Eliminar adjunto')).toBeInTheDocument();
    });

    it('NO renderiza botón de descarga', () => {
      render(<AttachmentPreview {...baseProps} onRemove={vi.fn()} />);
      expect(screen.queryByLabelText('Descargar adjunto')).not.toBeInTheDocument();
    });

    it('clic en × llama onRemove', () => {
      const onRemove = vi.fn();
      render(<AttachmentPreview {...baseProps} onRemove={onRemove} />);
      fireEvent.click(screen.getByLabelText('Eliminar adjunto'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('modo lectura (sin onRemove)', () => {
    it('renderiza botón de descarga', () => {
      render(<AttachmentPreview {...baseProps} />);
      expect(screen.getByLabelText('Descargar adjunto')).toBeInTheDocument();
    });

    it('NO renderiza botón ×', () => {
      render(<AttachmentPreview {...baseProps} />);
      expect(screen.queryByLabelText('Eliminar adjunto')).not.toBeInTheDocument();
    });
  });

  describe('renderizado de imagen', () => {
    it('renderiza img con el previewUrl correcto', () => {
      render(<AttachmentPreview {...baseProps} />);
      const img = screen.getByRole('img', { name: 'foto.png' });
      expect(img).toHaveAttribute('src', '/api/attachments/5/preview');
    });

    it('muestra el nombre del archivo debajo de la imagen', () => {
      render(<AttachmentPreview {...baseProps} />);
      expect(screen.getByText('foto.png')).toBeInTheDocument();
    });

    it('muestra "archivo no disponible" al fallar la carga de la imagen', () => {
      render(<AttachmentPreview {...baseProps} />);
      const img = screen.getByRole('img', { name: 'foto.png' });
      fireEvent.error(img);
      expect(screen.getByText('archivo no disponible')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('PDF', () => {
    it('renderiza un enlace <a> en lugar de <img> para PDFs', () => {
      render(
        <AttachmentPreview
          attachmentId={10}
          fileName="informe.pdf"
          previewUrl="/api/attachments/10/preview"
          mimeType="application/pdf"
        />
      );
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/api/attachments/10/preview');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('archivo no disponible (TS-39)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('un 404 con code file_not_available muestra el mensaje entendible con role=alert', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ code: 'file_not_available' }),
        })
      );

      render(<AttachmentPreview {...baseProps} />);
      fireEvent.error(screen.getByRole('img', { name: 'foto.png' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('El archivo no está disponible');
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('cualquier otro fallo conserva el comportamiento actual', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ code: 'internal_error' }),
        })
      );

      render(<AttachmentPreview {...baseProps} />);
      fireEvent.error(screen.getByRole('img', { name: 'foto.png' }));

      expect(await screen.findByText('archivo no disponible')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('si el fetch de diagnóstico falla, no inventa un mensaje de error nuevo', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

      render(<AttachmentPreview {...baseProps} />);
      fireEvent.error(screen.getByRole('img', { name: 'foto.png' }));

      expect(await screen.findByText('archivo no disponible')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
