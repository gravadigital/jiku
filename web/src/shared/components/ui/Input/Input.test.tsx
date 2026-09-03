import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('asocia el label al campo (TS-12)', () => {
    render(<Input label="Nombre del proyecto" value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Nombre del proyecto')).toBeInTheDocument();
  });

  it('marca la obligatoriedad de forma accesible (TS-13)', () => {
    render(<Input label="Nombre" required value="" onChange={vi.fn()} />);

    const input = screen.getByLabelText(/Nombre/);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('con error string marca aria-invalid y enlaza el mensaje (TS-14)', () => {
    render(
      <Input
        label="Email"
        error="Ingresá un email válido"
        value="juan@"
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Ingresá un email válido');
  });

  it('sin error no marca aria-invalid (TS-15)', () => {
    render(<Input label="Email" value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('variant date muestra placeholder de formato e icono de calendario (TS-16)', () => {
    const { container } = render(
      <Input variant="date" label="Fecha de cierre estimada" value="" onChange={vi.fn()} />,
    );

    const input = screen.getByLabelText('Fecha de cierre estimada');
    expect(input).toHaveAttribute('placeholder', 'mm/dd/aaaa');
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('variant date acepta escritura además del selector (TS-17)', async () => {
    const onChange = vi.fn();
    render(<Input variant="date" label="Fecha" value="" onChange={onChange} />);

    const input = screen.getByLabelText('Fecha');
    expect(input).not.toHaveAttribute('readonly');

    await userEvent.type(input, '9');

    expect(onChange).toHaveBeenCalled();
  });

  it('variant search renderiza lupa y placeholder configurable (TS-18)', () => {
    const { container } = render(
      <Input variant="search" label="Buscar" placeholder="Buscar proyecto" value="" onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('Buscar')).toHaveAttribute('placeholder', 'Buscar proyecto');
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('variant textarea renderiza un <textarea> (TS-19)', () => {
    render(<Input variant="textarea" label="Descripción" value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText('Descripción').tagName).toBe('TEXTAREA');
  });

  it('variant locked no es editable (TS-20)', async () => {
    const onChange = vi.fn();
    render(<Input variant="locked" label="Estado" value="Análisis" onChange={onChange} />);

    const input = screen.getByLabelText('Estado');
    expect(input).toHaveAttribute('readonly');

    await userEvent.type(input, 'x');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('propaga el valor escrito (TS-21)', async () => {
    const onChange = vi.fn();
    render(<Input label="Nombre" value="" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Nombre'), 'EXO');

    expect(onChange).toHaveBeenCalledTimes(3);
  });
});
