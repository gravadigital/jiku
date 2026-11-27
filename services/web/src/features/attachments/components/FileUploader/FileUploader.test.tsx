import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile } from '../../services/attachmentsClientApi';
import { FileUploader } from './FileUploader';

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('../../services/attachmentsClientApi', () => ({
  uploadFile: vi.fn(),
}));

function renderUploader(props?: { entityType?: 'objective' | 'project' }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FileUploader entityId={1} entityType={props?.entityType ?? 'project'} />
    </QueryClientProvider>
  );
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function makeFile(name: string, type = 'application/pdf'): File {
  return new File(['contenido'], name, { type });
}

function selectFiles(files: File[]) {
  fireEvent.change(fileInput(), { target: { files } });
}

let nextFileId = 1000;

beforeEach(() => {
  vi.clearAllMocks();
  nextFileId = 1000;
  vi.mocked(uploadFile).mockImplementation(async () => nextFileId++);
});

describe('FileUploader — cola de a uno', () => {
  it('tres archivos son tres tickets y tres PUT, secuenciales', async () => {
    const order: string[] = [];
    vi.mocked(uploadFile).mockImplementation(async (file) => {
      order.push(`start:${file.name}`);
      await Promise.resolve();
      order.push(`end:${file.name}`);
      return nextFileId++;
    });

    renderUploader();
    selectFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')]);

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(3);
    });
    // El PUT de b empieza después de que el de a termina.
    expect(order.indexOf('start:b.pdf')).toBeGreaterThan(order.indexOf('end:a.pdf'));
    expect(order.indexOf('start:c.pdf')).toBeGreaterThan(order.indexOf('end:b.pdf'));
  });

  it('el fallo de un archivo no cancela los otros', async () => {
    vi.mocked(uploadFile).mockImplementation(async (file) => {
      if (file.name === 'b.pdf') {
        throw new Error('La URL de subida venció. Volvé a intentarlo.');
      }
      return nextFileId++;
    });

    renderUploader();
    selectFiles([makeFile('a.pdf'), makeFile('b.pdf'), makeFile('c.pdf')]);

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(3);
    });
    const uploaded = vi.mocked(uploadFile).mock.calls.map((call) => call[0].name);
    expect(uploaded).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('La URL de subida venció');
    });
  });

  it('el progreso nombra el archivo en curso, no el lote', async () => {
    vi.mocked(uploadFile).mockImplementation((_file, options) => {
      options?.onProgress?.(30);
      return new Promise(() => {});
    });

    renderUploader();
    selectFiles([makeFile('informe.pdf'), makeFile('captura.png', 'image/png')]);

    await waitFor(() => {
      expect(screen.getByText('Subiendo informe.pdf...')).toBeInTheDocument();
    });
    expect(screen.queryByText(/captura\.png/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subiendo archivos/)).not.toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('la barra de progreso declara los cuatro atributos ARIA', async () => {
    vi.mocked(uploadFile).mockImplementation((_file, options) => {
      options?.onProgress?.(67);
      return new Promise(() => {});
    });

    renderUploader();
    selectFiles([makeFile('informe.pdf')]);

    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '67');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('ofrece reintento cuando la URL vence, y el reintento pide un ticket nuevo', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadFile).mockRejectedValueOnce(
      Object.assign(new Error('La URL de subida venció. Volvé a intentarlo.'), {
        code: 'expired_upload_url',
      })
    );

    renderUploader();
    selectFiles([makeFile('informe.pdf')]);

    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    vi.mocked(uploadFile).mockResolvedValue(2000);
    await user.click(retry);

    // El reintento vuelve a llamar a uploadFile, que pide un ticket nuevo.
    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledTimes(2);
    });
  });

  it('invalida la lista de adjuntos al terminar la cola', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    render(
      <QueryClientProvider client={client}>
        <FileUploader entityId={7} entityType="project" />
      </QueryClientProvider>
    );

    selectFiles([makeFile('informe.pdf')]);

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['attachments', 'project', 7] });
    });
  });
});

describe('FileUploader — microcopy sin límites', () => {
  it('el texto por defecto es singular y no nombra límites ni extensiones', () => {
    renderUploader();

    expect(
      screen.getByText('Arrastrá un archivo acá o hacé click para seleccionarlo')
    ).toBeInTheDocument();

    const rendered = document.body.textContent ?? '';
    expect(rendered).not.toContain('10MB');
    expect(rendered).not.toContain('10 MB');
    expect(rendered).not.toContain('.pdf');
    expect(rendered).not.toContain('.docx');
    expect(rendered).not.toContain('Formatos');
  });

  it('muestra el mensaje del servidor por tamaño dentro del role="alert"', async () => {
    vi.mocked(uploadFile).mockRejectedValue(
      Object.assign(new Error('El archivo supera el tamaño máximo permitido'), {
        code: 'file_too_large',
        status: 400,
      })
    );

    renderUploader();
    selectFiles([makeFile('grande.pdf')]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'El archivo supera el tamaño máximo permitido'
      );
    });
  });

  it('muestra el mensaje del servidor por tipo dentro del role="alert"', async () => {
    vi.mocked(uploadFile).mockRejectedValue(
      Object.assign(new Error('Ese tipo de archivo no está permitido'), {
        code: 'file_type_not_allowed',
        status: 400,
      })
    );

    renderUploader();
    selectFiles([makeFile('raro.exe', 'application/x-msdownload')]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Ese tipo de archivo no está permitido');
    });
  });

  it('el error de permisos se sigue interpolando por entidad', async () => {
    vi.mocked(uploadFile).mockRejectedValue(new Error('permission denied'));

    renderUploader({ entityType: 'objective' });
    selectFiles([makeFile('archivo.pdf')]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No tenés permisos para subir archivos a esta tarea'
      );
    });
  });
});
