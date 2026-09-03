import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dropzone } from './Dropzone';

function makeFile(name: string, sizeBytes: number, type: string): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('Dropzone', () => {
  it('tiene un input type="file" real detrás (TS-8)', () => {
    const { container } = render(<Dropzone onFiles={vi.fn()} />);
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('la instrucción es el nombre accesible del input (TS-9)', () => {
    render(<Dropzone onFiles={vi.fn()} />);
    expect(
      screen.getByLabelText(/Arrastrá archivos aquí o hacé click para seleccionar/)
    ).toBeInstanceOf(HTMLInputElement);
  });

  it('la restricción está siempre visible y asociada por aria-describedby (TS-10)', () => {
    render(<Dropzone onFiles={vi.fn()} />);
    const restriction = screen.getByText(
      'Máximo 10 MB por archivo. No se permiten ejecutables ni scripts.'
    );
    expect(restriction).toBeVisible();
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toContain(restriction.id);
  });

  it('multiple por defecto es true (TS-11)', () => {
    render(<Dropzone onFiles={vi.fn()} />);
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });

  it('multiple={false} lo quita (TS-12)', () => {
    render(<Dropzone onFiles={vi.fn()} multiple={false} />);
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;
    expect(input.multiple).toBe(false);
  });

  it('accept se propaga al input (TS-13)', () => {
    render(<Dropzone onFiles={vi.fn()} accept="image/png,application/pdf" />);
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;
    expect(input.accept).toBe('image/png,application/pdf');
  });

  it('seleccionar un archivo dispara onFiles (TS-14)', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;

    await user.upload(input, new File(['x'], 'a.png', { type: 'image/png' }));

    expect(onFiles).toHaveBeenCalledTimes(1);
    const files = onFiles.mock.calls[0][0];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('a.png');
  });

  it('el drop dispara onFiles (TS-15)', () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);
    const zone = screen.getByTestId('dropzone-area');
    const file = new File(['x'], 'b.pdf', { type: 'application/pdf' });

    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0].name).toBe('b.pdf');
  });

  it('dragover cambia el borde a sólido, no solo el color (TS-16)', () => {
    render(<Dropzone onFiles={vi.fn()} />);
    const zone = screen.getByTestId('dropzone-area');

    fireEvent.dragOver(zone);

    expect(zone.className).toMatch(/_dragover_/);
  });

  it('salir del dragover restaura el estado (TS-17)', () => {
    render(<Dropzone onFiles={vi.fn()} />);
    const zone = screen.getByTestId('dropzone-area');

    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);

    expect(zone.className).not.toMatch(/_dragover_/);
  });

  it('un archivo que supera maxSize se rechaza con la razón (TS-18)', async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} maxSize={10485760} />);
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;
    const bigFile = makeFile('big.png', 11 * 1024 * 1024, 'image/png');

    await user.upload(input, bigFile);

    expect(onFiles).not.toHaveBeenCalled();
    const message = screen.getByText('El archivo supera 10 MB');
    expect(message.closest('[aria-live]')).not.toBeNull();
  });

  it('la prop error se muestra en la región aria-live (TS-19)', () => {
    render(<Dropzone onFiles={vi.fn()} error="Tipo de archivo no permitido" />);
    const message = screen.getByText('Tipo de archivo no permitido');
    expect(message.closest('[aria-live]')).not.toBeNull();
  });

  it('el estado uploading muestra el loader con su texto (TS-20)', () => {
    render(<Dropzone onFiles={vi.fn()} uploading />);
    expect(screen.getByText('Subiendo archivo…')).toBeVisible();
  });

  it('Enter sobre la zona abre el selector (TS-21)', async () => {
    const user = userEvent.setup();
    render(<Dropzone onFiles={vi.fn()} />);
    const zone = screen.getByTestId('dropzone-area');
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    zone.focus();
    await user.keyboard('{Enter}');

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('Space sobre la zona abre el selector (TS-22)', async () => {
    const user = userEvent.setup();
    render(<Dropzone onFiles={vi.fn()} />);
    const zone = screen.getByTestId('dropzone-area');
    const input = screen.getByLabelText(/Arrastrá archivos/) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    zone.focus();
    await user.keyboard(' ');

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
