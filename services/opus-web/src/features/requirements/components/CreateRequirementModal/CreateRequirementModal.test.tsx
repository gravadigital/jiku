import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRequirementModal } from './CreateRequirementModal';
import { vi } from 'vitest';

const mockUploadFile = vi.fn();
const mockMutate = vi.fn();
const mockUseCreateRequirement = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null as unknown,
}));

vi.mock('@/features/attachments/services/attachmentsApi', () => ({
  attachmentsApi: {
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
    getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
    getFilePreviewUrl: (id: number) => `/api/files/${id}/preview`,
  },
}));

vi.mock('../../hooks/useCreateRequirement', () => ({
  useCreateRequirement: () => mockUseCreateRequirement(),
}));

vi.mock('@/features/projects/hooks/useProjects', () => ({
  useProjects: () => ({
    data: [{ id: 3, name: 'Proyecto Alpha' }],
  }),
}));

vi.mock('@/contexts/ProjectContext', () => ({
  useActiveProject: () => ({ activeProject: { id: 3, name: 'Proyecto Alpha' } }),
}));

vi.mock('@/features/subscriptions/hooks/useProjectUsers', () => ({
  useProjectUsers: () => ({ data: [] }),
}));

vi.mock('@/features/subscriptions/components/UserSelector', () => ({
  UserSelector: () => <div data-testid="user-selector" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/shared/components/ui/RichTextEditor/RichTextEditor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    placeholder,
    uploading,
    uploadingFileName,
    uploadProgress,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    uploading?: boolean;
    uploadingFileName?: string;
    uploadProgress?: number;
  }) => (
    <div>
      <textarea
        data-testid="rich-text-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {uploading && (
        <div role="progressbar" aria-valuenow={uploadProgress}>
          {`Subiendo ${uploadingFileName}... ${uploadProgress}%`}
        </div>
      )}
    </div>
  ),
}));

const uploaded = {
  fileId: 42,
  fileName: 'foto.png',
  mimeType: 'image/png',
  fileSize: 51200,
};

function resetMocks() {
  vi.clearAllMocks();
  mockUseCreateRequirement.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  });
}

describe('CreateRequirementModal — integración RichTextEditor', () => {
  beforeEach(resetMocks);

  it('renderiza RichTextEditor en lugar de textarea nativo para descripción', () => {
    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('NO existe div.descPreviews separado', () => {
    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    expect(document.querySelector('.descPreviews')).not.toBeInTheDocument();
  });

  it('eliminar adjunto via onChange sincroniza pendingAttachments', async () => {
    mockUploadFile.mockResolvedValue(uploaded);

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    const fileInput = screen.getByTestId('desc-file-input');
    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

    // Simula que RichTextEditor dispara onChange sin el placeholder (adjunto eliminado)
    const editor = screen.getByTestId('rich-text-editor');
    fireEvent.change(editor, { target: { value: 'sin attach' } });

    // Crear el objetivo: fileIds debe estar vacío
    const titleInput = screen.getByPlaceholderText('Título del requisito');
    await userEvent.type(titleInput, 'Test');
    fireEvent.click(screen.getByText('Crear elemento'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ fileIds: [] }),
        expect.anything()
      );
    });
  });
});

describe('CreateRequirementModal — S-007: el adjunto deja de ser borrador', () => {
  beforeEach(resetMocks);

  it('TS-31: sube sin entityType ni entityId, y sin la cadena requirement_draft', async () => {
    mockUploadFile.mockResolvedValue(uploaded);

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('desc-file-input'), { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

    const args = mockUploadFile.mock.calls[0];
    expect(args).toHaveLength(2);
    expect(args[0]).toBe(file);
    expect(typeof args[1]).toBe('function');
    expect(JSON.stringify(args.slice(1))).not.toContain('requirement_draft');
  });

  it('TS-30: el alta manda fileIds, sin attachmentIds ni attachmentScope', async () => {
    mockUploadFile.mockResolvedValue(uploaded);

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('desc-file-input'), { target: { files: [file] } });
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

    await userEvent.type(
      screen.getByPlaceholderText('Título del requisito'),
      'Necesito un reporte'
    );
    fireEvent.click(screen.getByText('Crear elemento'));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    const payload = mockMutate.mock.calls[0][0];
    expect(payload.fileIds).toEqual([42]);
    expect(payload).not.toHaveProperty('attachmentIds');
    expect(payload).not.toHaveProperty('attachmentScope');
  });

  it('TS-32: el requisito y sus vínculos se crean en una sola operación', async () => {
    mockUploadFile
      .mockResolvedValueOnce({ ...uploaded, fileId: 1 })
      .mockResolvedValueOnce({ ...uploaded, fileId: 2, fileName: 'b.png' })
      .mockResolvedValueOnce({ ...uploaded, fileId: 3, fileName: 'c.png' });

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    for (const name of ['a.png', 'b.png', 'c.png']) {
      fireEvent.change(screen.getByTestId('desc-file-input'), {
        target: { files: [new File(['x'], name, { type: 'image/png' })] },
      });
      await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    }
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalledTimes(3));

    await userFillTitleAndCreate();

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0].fileIds).toEqual([1, 2, 3]);
  });

  it('el botón de crear se bloquea mientras sube', async () => {
    let resolveUpload!: (v: unknown) => void;
    mockUploadFile.mockReturnValue(new Promise((r) => (resolveUpload = r)));

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('desc-file-input'), {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });

    await waitFor(() => expect(screen.getByText('Crear elemento')).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Adjuntar archivo a descripción' })).toBeDisabled();

    resolveUpload(uploaded);
    await waitFor(() => expect(screen.getByText('Crear elemento')).not.toBeDisabled());
  });

  it('muestra el progreso real de la subida', async () => {
    mockUploadFile.mockImplementation(async (_f: File, onProgress: (p: number) => void) => {
      onProgress(58);
      await new Promise(() => {});
    });

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('desc-file-input'), {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });

    expect(await screen.findByText('Subiendo foto.png... 58%')).toBeInTheDocument();
  });

  it('TS-35: el rechazo por tamaño no nombra el límite', async () => {
    mockUploadFile.mockRejectedValue({
      code: 'file_too_large',
      status: 400,
      message: 'File exceeds 10485760 bytes',
    });

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('desc-file-input'), {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El archivo supera el tamaño máximo permitido');
    expect(alert.textContent).not.toMatch(/10\s?MB/i);
  });

  it('TS-36: el rechazo por tipo no enumera extensiones', async () => {
    mockUploadFile.mockRejectedValue({ code: 'file_type_not_allowed', status: 400, message: '' });

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId('desc-file-input'), {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ese tipo de archivo no está permitido');
    expect(alert.textContent).not.toMatch(/docx|xlsx|pptx/i);
  });

  it('TS-40: el DOM no nombra los límites en ningún estado', async () => {
    const { container } = render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    expect(container.textContent).not.toMatch(/10\s?MB/i);

    const big = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId('desc-file-input'), { target: { files: [big] } });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(document.body.textContent).not.toMatch(/10\s?MB/i);
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('el error de creación por titularidad se muestra como permisos', async () => {
    mockUseCreateRequirement.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { code: 'file_not_owned', status: 403, message: 'File not owned' },
    });

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No podés adjuntar un archivo que subió otra persona');
    expect(alert).not.toHaveTextContent('File not owned');
  });

  it('TS-43 / criterio 10: cerrar el modal con archivos subidos no dispara ningún borrado', async () => {
    mockUploadFile.mockResolvedValue(uploaded);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const onClose = vi.fn();

    render(<CreateRequirementModal isOpen onClose={onClose} />);
    fireEvent.change(screen.getByTestId('desc-file-input'), {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText('Cerrar'));

    expect(onClose).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

async function userFillTitleAndCreate() {
  await userEvent.type(screen.getByPlaceholderText('Título del requisito'), 'Necesito un reporte');
  fireEvent.click(screen.getByText('Crear elemento'));
  await waitFor(() => expect(screen.getByText('Crear elemento')).toBeInTheDocument());
}

describe('CreateRequirementModal — envío de type en minúscula (contrato de API)', () => {
  beforeEach(resetMocks);

  it('envía type: "otro" por defecto (no "Otro")', async () => {
    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    const titleInput = screen.getByPlaceholderText('Título del requisito');
    await userEvent.type(titleInput, 'Test sin tipo elegido');
    fireEvent.click(screen.getByText('Crear elemento'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'otro' }),
        expect.anything()
      );
    });
  });

  it('envía type: "incidencia" en minúscula cuando se selecciona "Incidencia" en el dropdown', async () => {
    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('dropdown-type'));
    fireEvent.click(screen.getByText('Incidencia'));

    const titleInput = screen.getByPlaceholderText('Título del requisito');
    await userEvent.type(titleInput, 'Test con incidencia');
    fireEvent.click(screen.getByText('Crear elemento'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'incidencia' }),
        expect.anything()
      );
    });
  });
});
