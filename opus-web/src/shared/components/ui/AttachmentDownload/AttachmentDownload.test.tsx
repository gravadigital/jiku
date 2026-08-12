import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentDownload } from './AttachmentDownload';
import { vi } from 'vitest';

describe('AttachmentDownload', () => {
  describe('retro-compatibilidad (sin nuevas props)', () => {
    it('renderiza el nombre del archivo', () => {
      render(<AttachmentDownload attachmentId={7} fileName="doc.pdf" />);
      expect(screen.getByText('doc.pdf')).toBeInTheDocument();
    });

    it('muestra "Archivo adjunto" cuando fileName está vacío', () => {
      render(<AttachmentDownload attachmentId={7} fileName="" />);
      expect(screen.getByText('Archivo adjunto')).toBeInTheDocument();
    });
  });

  describe('modo redacción (con onRemove)', () => {
    it('renderiza botón × y NO renderiza botón de descarga', () => {
      render(
        <AttachmentDownload
          attachmentId={7}
          fileName="doc.pdf"
          fileSize={43008}
          onRemove={vi.fn()}
        />
      );
      expect(screen.getByLabelText('Eliminar adjunto')).toBeInTheDocument();
      expect(screen.queryByLabelText('Descargar adjunto')).not.toBeInTheDocument();
    });

    it('clic en × llama onRemove', () => {
      const onRemove = vi.fn();
      render(<AttachmentDownload attachmentId={7} fileName="doc.pdf" onRemove={onRemove} />);
      fireEvent.click(screen.getByLabelText('Eliminar adjunto'));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('modo lectura (sin onRemove)', () => {
    it('renderiza botón de descarga y NO renderiza botón ×', () => {
      render(<AttachmentDownload attachmentId={7} fileName="doc.pdf" fileSize={43008} />);
      expect(screen.getByLabelText('Descargar adjunto')).toBeInTheDocument();
      expect(screen.queryByLabelText('Eliminar adjunto')).not.toBeInTheDocument();
    });
  });

  describe('fileSize', () => {
    it('muestra "42 KB" para fileSize=43008', () => {
      render(<AttachmentDownload attachmentId={7} fileName="doc.pdf" fileSize={43008} />);
      expect(screen.getByText('42 KB')).toBeInTheDocument();
    });

    it('muestra "1.5 MB" para fileSize=1572864', () => {
      render(<AttachmentDownload attachmentId={7} fileName="doc.pdf" fileSize={1572864} />);
      expect(screen.getByText('1.5 MB')).toBeInTheDocument();
    });

    it('no muestra tamaño cuando fileSize es undefined', () => {
      render(<AttachmentDownload attachmentId={7} fileName="doc.pdf" />);
      expect(screen.queryByText(/KB/)).not.toBeInTheDocument();
      expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
    });
  });

  describe('PDF vs no-PDF', () => {
    it('PDF: enlace de nombre sin atributo download', () => {
      render(<AttachmentDownload attachmentId={10} fileName="informe.pdf" />);
      const nameLink = screen.getByText('informe.pdf').closest('a')!;
      expect(nameLink).toHaveAttribute('href', '/api/attachments/10/preview');
      expect(nameLink).not.toHaveAttribute('download');
    });

    it('no-PDF: enlace de nombre con atributo download', () => {
      render(<AttachmentDownload attachmentId={11} fileName="imagen.png" />);
      const nameLink = screen.getByText('imagen.png').closest('a')!;
      expect(nameLink).toHaveAttribute('download', 'imagen.png');
    });
  });
});
