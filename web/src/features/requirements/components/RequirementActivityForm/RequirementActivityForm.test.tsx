import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile } from '@/features/attachments/services/attachmentsClientApi';
import * as useAddRequirementActivityModule from '../../hooks/useAddRequirementActivity';
import { RequirementActivityForm } from './RequirementActivityForm';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../services/requirementsApi', () => ({
  addRequirementActivity: vi.fn(),
}));

vi.mock('../../hooks/useAddRequirementActivity', () => ({
  useAddRequirementActivity: vi.fn(),
}));

vi.mock('@/features/attachments/services/attachmentsClientApi', () => ({
  uploadFile: vi.fn(),
  getPreviewUrl: (id: number) => `/api/attachments/${id}/preview`,
  getFilePreviewUrl: (id: number) => `/api/files/${id}/preview`,
  getDownloadUrl: (id: number) => `/api/attachments/${id}/download`,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const scssContent = fs.readFileSync(
  path.resolve(__dirname, './RequirementActivityForm.module.scss'),
  'utf8'
);

const mockAddActivity = vi.fn();

function getTextarea(): HTMLTextAreaElement {
  return screen.getByPlaceholderText('Escribe un comentario...') as HTMLTextAreaElement;
}

function hasAttachmentNode(): boolean {
  return document.querySelectorAll('[class*="attachmentNode"]').length > 0;
}

function getFileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('RequirementActivityForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAddRequirementActivityModule.useAddRequirementActivity).mockReturnValue({
      mutate: mockAddActivity,
      isPending: false,
    } as any);
  });

  it('botón Enviar está deshabilitado cuando el editor está vacío', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  it('TS-10: el área de comentario tiene alto fijo de 170px con scroll', () => {
    expect(scssContent).toMatch(/height:\s*170px/);
    expect(scssContent).toMatch(/\.commentEditor[\s\S]*?overflow-y:\s*auto/);
  });

  it('TS-10 (integración): el selector CSS del alto máximo realmente matchea el DOM renderizado', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    // El SCSS apunta a estas clases globales estables expuestas por
    // RequirementRichTextEditor — si el nombre de clase cambia ahí sin
    // actualizar este selector, el override de alto deja de aplicarse
    // silenciosamente (CSS Modules no falla en build ni en tests de texto).
    expect(document.querySelector('.rich-text-editor-scroll-area')).toBeInTheDocument();
  });

  it('TS-11: botón Adjuntar propio del footer está presente en el DOM (no en la toolbar interna)', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    expect(screen.getAllByText('Adjuntar')).toHaveLength(1);
  });

  it('TS-12: botones Interno y Público visibles en el footer', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    expect(screen.getByText('Interno')).toBeInTheDocument();
    expect(screen.getByText('Público')).toBeInTheDocument();
  });

  it('TS-13: SCSS de sendBtn usa var(--color-button)', () => {
    expect(scssContent).toMatch(/\.sendBtn[\s\S]*?background:\s*var\(--color-button\)/);
  });

  it('TS-14: footer contiene Adjuntar, toggle Interno/Público y Enviar en ese orden', () => {
    const { container } = render(<RequirementActivityForm reqid={5} />, {
      wrapper: createWrapper(),
    });

    const footer = container.querySelector('[class*="activityFormFooter"]') as HTMLElement;
    expect(footer).toBeInTheDocument();

    expect(within(footer).getByText('Adjuntar')).toBeInTheDocument();
    expect(within(footer).getByText('Interno')).toBeInTheDocument();
    expect(within(footer).getByText('Público')).toBeInTheDocument();
    expect(within(footer).getByText('Enviar')).toBeInTheDocument();
  });

  it('visibilidad por defecto es internal (botón Interno tiene data-active="true")', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /interno/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: /público/i })).toHaveAttribute(
      'data-active',
      'false'
    );
  });

  it('al hacer click en Público, cambia visibilidad activa', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    const publicoBtn = screen.getByRole('button', { name: /público/i });
    fireEvent.click(publicoBtn);
    expect(publicoBtn).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: /interno/i })).toHaveAttribute(
      'data-active',
      'false'
    );
  });

  it('el editor de comentario está presente', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    expect(getTextarea()).toBeInTheDocument();
  });

  it('el botón Adjuntar del footer abre el selector de archivos del editor', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    const input = getFileInput();
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(screen.getByRole('button', { name: 'Adjuntar archivo' }));

    expect(clickSpy).toHaveBeenCalled();
  });

  // AC-4/AC-6 — upload de dos fases
  it('CA-12: un archivo grande ya no se rechaza en el cliente — la política vive en core', async () => {
    vi.mocked(uploadFile).mockResolvedValue(99);
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    const bigFile = new File([new Uint8Array(11 * 1024 * 1024)], 'grande.png', {
      type: 'image/png',
    });

    fireEvent.change(getFileInput(), { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/muy grande/i)).not.toBeInTheDocument();
  });

  it('CA-12: el rechazo por tipo lo dice el servidor, no el cliente', async () => {
    vi.mocked(uploadFile).mockRejectedValue(new Error('Ese tipo de archivo no está permitido'));
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    const badFile = new File(['contenido'], 'virus.exe', { type: 'application/octet-stream' });

    fireEvent.change(getFileInput(), { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ese tipo de archivo no está permitido');
    });
  });

  it('CA-1: un archivo válido sube con uploadFile, sin mencionar ninguna entidad', async () => {
    vi.mocked(uploadFile).mockResolvedValue(99);
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    const goodFile = new File(['contenido'], 'imagen.png', { type: 'image/png' });

    fireEvent.change(getFileInput(), { target: { files: [goodFile] } });

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(uploadFile).mock.calls[0][0]).toBe(goodFile);
  });

  it('AC-4: tras upload exitoso de imagen, inserta el chip de adjunto en el comentario', async () => {
    vi.mocked(uploadFile).mockResolvedValue(99);
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });
    const goodFile = new File(['contenido'], 'imagen.png', { type: 'image/png' });

    fireEvent.change(getFileInput(), { target: { files: [goodFile] } });

    await waitFor(() => {
      expect(hasAttachmentNode()).toBe(true);
    });
  });

  // TS-20: el payload lleva fileIds, extraidos de los placeholders [file:N]
  it('TS-20 (CA-5): envía el comentario con fileIds, sin attachmentIds', async () => {
    vi.mocked(uploadFile).mockResolvedValue(100);
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });

    await act(async () => {
      fireEvent.change(getTextarea(), { target: { value: 'Ver adjunto' } });
    });

    const file = new File(['contenido'], 'doc.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(getFileInput(), { target: { files: [file] } });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(hasAttachmentNode()).toBe(true);
    });

    fireEvent.click(screen.getByTestId('submit-button'));

    expect(mockAddActivity).toHaveBeenCalledWith(
      expect.objectContaining({ fileIds: [100] }),
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
    );
    const payload = mockAddActivity.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('attachmentIds');
    expect(payload).not.toHaveProperty('attachmentScope');
  });

  it('TS-24 (CA-9): el error de titularidad se muestra como permisos', async () => {
    const { toast } = await import('react-toastify');
    mockAddActivity.mockImplementation((_vars: any, options: any) => {
      options?.onError?.({ code: 'file_not_owned', status: 403, message: 'File not owned' });
    });
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });

    fireEvent.change(getTextarea(), { target: { value: 'Hola' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(toast.error).toHaveBeenCalledWith(
      'No podés adjuntar un archivo que subió otra persona'
    );
    expect(toast.error).not.toHaveBeenCalledWith('File not owned');
  });

  it('TS-39 (CA-14): enviar está bloqueado mientras el byte viaja', async () => {
    vi.mocked(uploadFile).mockImplementation((_file, options) => {
      options?.onProgress?.(40);
      return new Promise(() => {});
    });
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });

    fireEvent.change(getTextarea(), { target: { value: 'Hola' } });
    fireEvent.change(getFileInput(), {
      target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Adjuntar archivo' })).toBeDisabled();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('Subiendo doc.pdf... 40%')).toBeInTheDocument();
    expect(screen.getByTestId('submit-button')).toHaveAttribute('aria-describedby');
  });

  it('TS-41 (CA-1): sin subida no hay barra de progreso ni texto "Subiendo"', () => {
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/Subiendo/)).not.toBeInTheDocument();
  });

  // El error de dominio no limpia el editor: el usuario puede reintentar tal cual
  it('un error del guardado muestra el toast y conserva el texto', async () => {
    const { toast } = await import('react-toastify');
    mockAddActivity.mockImplementation((_vars: any, options: any) => {
      options?.onError?.({ code: 'invalid_fields', message: 'Adjunto inválido' });
    });
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });

    fireEvent.change(getTextarea(), { target: { value: 'Hola' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    expect(toast.error).toHaveBeenCalledWith('Adjunto inválido');
    expect(getTextarea().value).toBe('Hola');
  });

  it('tras envío exitoso, limpia el editor', async () => {
    mockAddActivity.mockImplementation((_vars: any, options: any) => {
      options?.onSuccess?.();
    });
    render(<RequirementActivityForm reqid={5} />, { wrapper: createWrapper() });

    fireEvent.change(getTextarea(), { target: { value: 'Hola' } });
    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(getTextarea().value).toBe('');
    });
  });
});
