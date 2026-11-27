import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextEditor } from './RichTextEditor';
import styles from './RichTextEditor.module.scss';
import { vi } from 'vitest';

vi.mock('../AttachmentPreview/AttachmentPreview', () => ({
  AttachmentPreview: ({
    attachmentId,
    previewUrl,
    onRemove,
  }: {
    attachmentId: number;
    previewUrl: string;
    onRemove?: () => void;
  }) => (
    <div data-testid={`preview-${attachmentId}`} data-preview-url={previewUrl}>
      {onRemove && (
        <button onClick={onRemove} aria-label="Eliminar adjunto">
          ×
        </button>
      )}
    </div>
  ),
}));

vi.mock('../AttachmentDownload/AttachmentDownload', () => ({
  AttachmentDownload: ({
    attachmentId,
    onRemove,
  }: {
    attachmentId: number;
    onRemove?: () => void;
  }) => (
    <div data-testid={`download-${attachmentId}`}>
      {onRemove && (
        <button onClick={onRemove} aria-label="Eliminar adjunto">
          ×
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/features/attachments/services/attachmentsApi', () => ({
  attachmentsApi: {
    getFilePreviewUrl: (fileId: number) => `/api/files/${fileId}/preview`,
    getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
  },
}));

describe('RichTextEditor', () => {
  describe('deserialización', () => {
    it('value vacío renderiza un textarea vacío', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('value con placeholder de imagen renderiza AttachmentPreview', () => {
      render(<RichTextEditor value="Hola ![attach:3] mundo" onChange={vi.fn()} />);
      expect(screen.getByTestId('preview-3')).toBeInTheDocument();
    });

    it('value con placeholder de archivo renderiza AttachmentDownload', () => {
      render(<RichTextEditor value="[attach:7]" onChange={vi.fn()} />);
      expect(screen.getByTestId('download-7')).toBeInTheDocument();
    });

    it('value con texto puro no renderiza AttachmentPreview ni AttachmentDownload', () => {
      render(<RichTextEditor value="Solo texto" onChange={vi.fn()} />);
      expect(screen.queryByTestId(/preview-/)).not.toBeInTheDocument();
      expect(screen.queryByTestId(/download-/)).not.toBeInTheDocument();
    });
  });

  describe('eliminación de segmentos', () => {
    it('eliminar nodo imagen llama onChange sin el placeholder de imagen', () => {
      const onChange = vi.fn();
      render(<RichTextEditor value="Hola ![attach:5] mundo" onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Eliminar adjunto'));
      expect(onChange).toHaveBeenCalled();
      const newValue: string = onChange.mock.calls[0][0];
      expect(newValue).not.toContain('![attach:5]');
      expect(newValue).toContain('Hola');
      expect(newValue).toContain('mundo');
    });

    it('eliminar nodo archivo llama onChange sin el placeholder de archivo', () => {
      const onChange = vi.fn();
      render(<RichTextEditor value="[attach:7]" onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Eliminar adjunto'));
      expect(onChange).toHaveBeenCalled();
      const newValue: string = onChange.mock.calls[0][0];
      expect(newValue).not.toContain('[attach:7]');
    });
  });

  describe('serialización', () => {
    it('TS-17: eliminar nodo de imagen serializa correctamente segmentos mixtos restantes', () => {
      const onChange = vi.fn();
      render(<RichTextEditor value="Hola ![attach:3] mundo" onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Eliminar adjunto'));
      const emitted: string = onChange.mock.calls[0][0];
      expect(emitted).toContain('Hola');
      expect(emitted).toContain('mundo');
      expect(emitted).not.toContain('![attach:3]');
    });

    it('texto editado emite onChange con el nuevo valor', async () => {
      const onChange = vi.fn();
      render(<RichTextEditor value="" onChange={onChange} />);
      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'Hola');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('placeholder', () => {
    it('muestra placeholder cuando value está vacío', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} placeholder="Escribe aquí..." />);
      expect(screen.getByPlaceholderText('Escribe aquí...')).toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('textarea está deshabilitado cuando disabled=true', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('progreso-subida-adjunto', () => {
    it('TS-20: muestra progreso real con role=progressbar y el microcopy exacto', () => {
      render(
        <RichTextEditor
          value=""
          onChange={vi.fn()}
          uploading
          uploadingFileName="informe.pdf"
          uploadProgress={58}
        />
      );

      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '58');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByText('Subiendo informe.pdf... 58%')).toBeInTheDocument();
      // El skeleton indeterminado se reemplaza, no se suma al lado. Se busca por su
      // aria-label, que es como AttachmentSkeleton se identifica.
      expect(screen.queryByLabelText('Cargando imagen...')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Cargando archivo...')).not.toBeInTheDocument();
    });

    it('TS-21: sin subida en curso no hay bloque de progreso', () => {
      render(<RichTextEditor value="" onChange={vi.fn()} uploading={false} />);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('el nombre accesible del progressbar incluye el archivo', () => {
      render(
        <RichTextEditor
          value=""
          onChange={vi.fn()}
          uploading
          uploadingFileName="informe.pdf"
          uploadProgress={12}
        />
      );
      expect(screen.getByRole('progressbar', { name: /informe\.pdf/ })).toBeInTheDocument();
    });

    it('el ancho del relleno es proporcional al progreso', () => {
      const { container } = render(
        <RichTextEditor
          value=""
          onChange={vi.fn()}
          uploading
          uploadingFileName="a.png"
          uploadProgress={30}
        />
      );
      const fill = container.querySelector(`.${styles.progressFill}`) as HTMLElement;
      expect(fill).toBeTruthy();
      expect(fill.style.width).toBe('30%');
    });
  });

  describe('URL de preview de los segmentos', () => {
    it('el editor lee por fileId: /api/files/{id}/preview', () => {
      render(<RichTextEditor value="![attach:1234]" onChange={vi.fn()} />);
      expect(screen.getByTestId('preview-1234')).toHaveAttribute(
        'data-preview-url',
        '/api/files/1234/preview'
      );
    });

    it('NO usa el espacio de ids de attachments', () => {
      render(<RichTextEditor value="![attach:1234]" onChange={vi.fn()} />);
      expect(screen.getByTestId('preview-1234')).not.toHaveAttribute(
        'data-preview-url',
        '/api/attachments/1234/preview'
      );
    });
  });
});
