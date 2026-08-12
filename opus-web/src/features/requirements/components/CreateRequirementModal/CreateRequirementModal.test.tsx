import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRequirementModal } from './CreateRequirementModal';
import { vi } from 'vitest';

const mockUploadFile = vi.fn();
const mockGetPreviewUrl = vi.fn((id: number) => `/api/attachments/${id}/preview`);
const mockMutate = vi.fn();

vi.mock('@/features/attachments/services/attachmentsApi', () => ({
  attachmentsApi: {
    uploadFile: (entityType: string, entityId: number, file: File) =>
      mockUploadFile(entityType, entityId, file),
    getPreviewUrl: (id: number) => mockGetPreviewUrl(id),
  },
}));

vi.mock('../../hooks/useCreateRequirement', () => ({
  useCreateRequirement: () => ({ mutate: mockMutate, isPending: false }),
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
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

describe('CreateRequirementModal — Tarea 7: integración RichTextEditor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza RichTextEditor en lugar de textarea nativo para descripción', () => {
    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('NO existe div.descPreviews separado', () => {
    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    expect(document.querySelector('.descPreviews')).not.toBeInTheDocument();
  });

  it('eliminar adjunto via onChange sincroniza pendingAttachments', async () => {
    mockUploadFile.mockResolvedValue([
      { id: 42, fileName: 'foto.png', mimeType: 'image/png', fileSize: 51200 },
    ]);

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);
    const fileInput = screen.getByTestId('desc-file-input');
    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

    // Simula que RichTextEditor dispara onChange sin el placeholder (adjunto eliminado)
    const editor = screen.getByTestId('rich-text-editor');
    fireEvent.change(editor, { target: { value: 'sin attach' } });

    // Crear el objetivo: attachmentIds debe estar vacío
    const titleInput = screen.getByPlaceholderText('Título del requisito');
    await userEvent.type(titleInput, 'Test');
    fireEvent.click(screen.getByText('Crear elemento'));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentIds: [] }),
        expect.anything()
      );
    });
  });
});

describe('CreateRequirementModal — Tarea 1: fix upload entityType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama uploadFile con requirement_draft y selectedProjectId (no con requirement y 0)', async () => {
    mockUploadFile.mockResolvedValue([
      { id: 42, fileName: 'foto.png', mimeType: 'image/png', fileSize: 51200 },
    ]);

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    const fileInput = screen.getByTestId('desc-file-input');
    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith('requirement_draft', 3, file);
    });

    expect(mockUploadFile).not.toHaveBeenCalledWith('requirement', 0, expect.anything());
  });

  it('agrega el attachment a pendingAttachments tras el upload', async () => {
    mockUploadFile.mockResolvedValue([
      { id: 42, fileName: 'foto.png', mimeType: 'image/png', fileSize: 51200 },
    ]);

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    const fileInput = screen.getByTestId('desc-file-input');
    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalled();
    });
  });

  it('incluye attachmentIds en el mutate al enviar el formulario', async () => {
    mockUploadFile.mockResolvedValue([
      { id: 42, fileName: 'foto.png', mimeType: 'image/png', fileSize: 51200 },
    ]);

    render(<CreateRequirementModal isOpen onClose={vi.fn()} />);

    const fileInput = screen.getByTestId('desc-file-input');
    const file = new File(['content'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled());

    const titleInput = screen.getByPlaceholderText('Título del requisito');
    await userEvent.type(titleInput, 'Test objetivo');

    const createBtn = screen.getByText('Crear elemento');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ attachmentIds: [42] }),
        expect.anything()
      );
    });
  });
});

describe('CreateRequirementModal — envío de type en minúscula (contrato de API)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
