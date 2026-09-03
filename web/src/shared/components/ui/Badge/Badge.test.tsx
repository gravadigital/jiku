import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Badge } from './Badge';

const SIETE_ESTADOS = [
  { value: 'planificacion', label: 'Planificación' },
  { value: 'en_cola', label: 'En cola' },
  { value: 'desarrollo', label: 'Desarrollo' },
  { value: 'revision', label: 'Revisión' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'analisis', label: 'Análisis' },
];

describe('Badge', () => {
  it('variant state comunica con punto más texto (TS-39)', () => {
    const { container } = render(
      <Badge variant="state" family="in-progress" label="Desarrollo" />,
    );

    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });

  it('variant state mapea la familia a su clase de color (TS-40)', () => {
    const { container } = render(
      <Badge variant="state" family="analysis" label="Planificación" />,
    );

    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toMatch(/familyAnalysis/);
    expect(badge.className).not.toMatch(/familyNeutral/);
  });

  it('no interactivo no expone rol de control (TS-41)', () => {
    render(<Badge variant="state" family="neutral" label="En cola" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('editable es un botón con nombre accesible que dice qué cambia (TS-42)', () => {
    render(
      <Badge
        variant="editable"
        family="in-progress"
        label="Desarrollo"
        options={SIETE_ESTADOS}
        onChange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /Estado: Desarrollo/ });
    expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('editable ofrece los siete estados sin recorte (TS-43)', async () => {
    render(
      <Badge
        variant="editable"
        family="in-progress"
        label="Desarrollo"
        options={SIETE_ESTADOS}
        onChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getAllByRole('option')).toHaveLength(7);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('editable sigue ofreciendo los siete estados cuando el actual es resuelto (TS-44)', async () => {
    render(
      <Badge
        variant="editable"
        family="resolved"
        label="Resuelto"
        options={SIETE_ESTADOS}
        onChange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    expect(screen.getAllByRole('option')).toHaveLength(7);
  });

  it('editable sigue ofreciendo los siete estados cuando el actual es cancelado (TS-45)', async () => {
    render(
      <Badge
        variant="editable"
        family="neutral"
        label="Cancelado"
        options={SIETE_ESTADOS}
        onChange={vi.fn()}
      />,
    );

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    expect(screen.getAllByRole('option')).toHaveLength(7);
  });

  it('editable devuelve el valor elegido (TS-46)', async () => {
    const onChange = vi.fn();
    render(
      <Badge
        variant="editable"
        family="in-progress"
        label="Desarrollo"
        options={SIETE_ESTADOS}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('option', { name: 'Revisión' }));

    expect(onChange).toHaveBeenCalledWith('revision');
  });

  it('campo sin valor usa el tinte grafito (TS-47)', () => {
    const { container } = render(<Badge variant="outline" family="neutral" label="Sin prioridad" />);

    const badge = container.firstChild as HTMLElement;
    expect(screen.getByText('Sin prioridad')).toBeInTheDocument();
    expect(badge.className).toMatch(/familyNeutral/);
  });

  it('variant area distingue por forma además de por color (TS-48)', () => {
    const { container } = render(<Badge variant="area" family="neutral" label="Desarrollo" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
  });
});
