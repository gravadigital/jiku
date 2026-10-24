import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCreateDocument } from '../../hooks/useCreateDocument';
import { NewDocumentDialog } from './NewDocumentDialog';

const push = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('../../hooks/useCreateDocument', () => ({ useCreateDocument: vi.fn() }));
vi.mock('../../utils/ulid', () => ({ newUlid: () => '01J9Z3K8M2Q4R6T8V0W2Y4A6C8' }));

const FOLDER = { id: '01J9Z3K8M2Q4R6T8V0W2Y4A6F0', path: '/clientes/acme/' };
const mutate = vi.fn();
const reset = vi.fn();

const setMutation = (over: Record<string, unknown> = {}) =>
  vi.mocked(useCreateDocument).mockReturnValue({
    mutate,
    reset,
    isPending: false,
    isError: false,
    error: null,
    ...over,
  } as never);

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <NewDocumentDialog open={open} folder={FOLDER} onClose={() => setOpen(false)} />
    </>
  );
}

describe('NewDocumentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMutation();
  });

  it('TS-63: se abre con foco en Título y Crear deshabilitado', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Nuevo documento' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Nuevo documento' })).toBeInTheDocument();
    expect(screen.getByText('Se crea en /clientes/acme/')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Crear y editar' })).toBeDisabled();
  });

  it('P-11: Título va antes que Nombre del archivo en el DOM', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const boxes = screen.getAllByRole('textbox');
    expect(boxes.map((b) => b.getAttribute('placeholder'))).toEqual([
      'Guía de despliegue',
      'guia-de-despliegue.md',
    ]);
  });

  it('TS-64: el título sugiere el nombre hasta que se edita a mano', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Guía de despliegue');
    const name = screen.getByRole('textbox', { name: 'Nombre del archivo' });
    expect(name).toHaveValue('guia-de-despliegue.md');
    await userEvent.clear(name);
    await userEvent.type(name, 'mi-guia');
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), ' 2');
    expect(name).toHaveValue('mi-guia');
  });

  it('TS-65: crea con id fijo, loading y navega al editor sin toast', async () => {
    mutate.mockImplementation((_payload, options) =>
      options.onSuccess({ id: '01J9Z3K8M2Q4R6T8V0W2Y4A6C8', version: 1 })
    );
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Guía de despliegue');
    const name = screen.getByRole('textbox', { name: 'Nombre del archivo' });
    await userEvent.clear(name);
    await userEvent.type(name, 'mi-guia');
    await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    expect(mutate).toHaveBeenCalledWith(
      {
        id: '01J9Z3K8M2Q4R6T8V0W2Y4A6C8',
        folderId: FOLDER.id,
        fileName: 'mi-guia.md',
        content: '# Guía de despliegue\n',
      },
      expect.any(Object)
    );
    expect(push).toHaveBeenCalledWith('/docs/01J9Z3K8M2Q4R6T8V0W2Y4A6C8?editar=1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('TS-65: mientras crea el botón está en loading', async () => {
    setMutation({ isPending: true });
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('button', { name: /Crear y editar/ })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('TS-66: sin título el contenido es vacío', async () => {
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nombre del archivo' }), 'notas');
    await userEvent.click(screen.getByRole('button', { name: 'Crear y editar' }));
    expect(mutate.mock.calls[0][0]).toMatchObject({ content: '', fileName: 'notas.md' });
  });

  it.each([
    ['already_exists', 'Ya hay un documento con ese nombre en esta carpeta.', true],
    ['file_name_invalid', 'Ese nombre no es válido. Usá minúsculas, números y guiones.', true],
    [
      'module_unavailable',
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.',
      false,
    ],
    ['gateway_timeout', 'No se pudo crear el documento. Intentá de nuevo.', false],
  ])('TS-67: error %s', async (code, message, inField) => {
    setMutation({ isError: true, error: { code, message: 'x', status: 500 } });
    render(<Host />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Título' }), 'Guía');
    expect(screen.getByText(message, { exact: false })).toBeInTheDocument();
    if (inField) {
      expect(screen.getByRole('textbox', { name: 'Nombre del archivo' })).toHaveAttribute(
        'aria-invalid',
        'true'
      );
    } else {
      expect(screen.getByRole('alert')).toHaveTextContent(message);
    }
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveValue('Guía');
    expect(screen.getByRole('dialog', { name: 'Nuevo documento' })).toBeInTheDocument();
  });

  it('TS-68: Cancelar y Escape cierran sin crear y devuelven el foco', async () => {
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });
});
