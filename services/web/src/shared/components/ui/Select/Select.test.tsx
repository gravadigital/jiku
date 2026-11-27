import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Select } from './Select';

describe('Select', () => {
  it('asocia el label al control (TS-22)', () => {
    render(
      <Select label="Cliente" options={[{ value: '1', label: 'EXO' }]} value="" onChange={vi.fn()} />,
    );

    expect(screen.getByRole('combobox', { name: 'Cliente' })).toBeInTheDocument();
  });

  it('abre el menú y muestra las opciones (TS-23)', async () => {
    render(
      <Select
        label="Estado"
        options={[
          { value: 'dev', label: 'Desarrollo' },
          { value: 'rev', label: 'Revisión' },
        ]}
        value=""
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', { name: 'Desarrollo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Revisión' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });

  it('cerrado no expone las opciones (TS-24)', () => {
    render(
      <Select
        label="Estado"
        options={[{ value: 'dev', label: 'Desarrollo' }]}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole('option', { name: 'Desarrollo' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('single devuelve el value elegido (TS-25)', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Estado"
        options={[
          { value: 'dev', label: 'Desarrollo' },
          { value: 'rev', label: 'Revisión' },
        ]}
        value=""
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Desarrollo' }));

    expect(onChange).toHaveBeenCalledWith('dev');
  });

  it('es operable sólo con teclado (TS-26)', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Estado"
        options={[
          { value: 'dev', label: 'Desarrollo' },
          { value: 'rev', label: 'Revisión' },
        ]}
        value=""
        onChange={onChange}
      />,
    );

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('rev');
  });

  it('Esc cierra el menú y devuelve el foco al control (TS-27)', async () => {
    render(
      <Select
        label="Estado"
        options={[{ value: 'dev', label: 'Desarrollo' }]}
        value=""
        onChange={vi.fn()}
      />,
    );

    const control = screen.getByRole('combobox');
    await userEvent.click(control);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(control).toHaveFocus();
  });

  it('multiple renderiza un chip por valor, con acción de remoción etiquetada (TS-28)', () => {
    render(
      <Select
        variant="multiple"
        label="Estado"
        options={[
          { value: 'plan', label: 'Planificación' },
          { value: 'cola', label: 'En cola' },
        ]}
        value={['plan', 'cola']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quitar En cola' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar Planificación' })).toBeInTheDocument();
  });

  it('multiple quita un chip y devuelve el resto (TS-29)', async () => {
    const onChange = vi.fn();
    render(
      <Select
        variant="multiple"
        label="Estado"
        options={[
          { value: 'plan', label: 'Planificación' },
          { value: 'cola', label: 'En cola' },
        ]}
        value={['plan', 'cola']}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Quitar En cola' }));

    expect(onChange).toHaveBeenCalledWith(['plan']);
  });

  it('con error string marca aria-invalid y enlaza el mensaje (TS-30)', () => {
    render(
      <Select label="Cliente" error="Elegí un cliente" options={[]} value="" onChange={vi.fn()} />,
    );

    const control = screen.getByRole('combobox');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    const describedBy = control.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Elegí un cliente');
  });

  it('locked no abre el menú (TS-31)', async () => {
    const onChange = vi.fn();
    render(
      <Select
        variant="locked"
        label="Estado"
        options={[{ value: 'a', label: 'Análisis' }]}
        value="a"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('inline no exige label visible pero conserva nombre accesible (TS-32)', () => {
    render(
      <Select
        variant="inline"
        options={[{ value: '5', label: '5 por página' }]}
        value="5"
        onChange={vi.fn()}
      />,
    );

    const control = screen.getByRole('combobox');
    expect(control.getAttribute('aria-label') || control.textContent).toBeTruthy();
    expect(screen.queryByText('5 por página')?.tagName).not.toBe('LABEL');
  });

  it('no importa react-select directamente ni copia selectStyles/customStyles (TS-33)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'Select.tsx'), 'utf-8');

    expect(source).not.toMatch(/from ['"]react-select['"]/);
    expect(source).not.toMatch(/selectStyles|customStyles/);
  });
});
