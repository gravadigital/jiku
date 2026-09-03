import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('Button', () => {
  it('renderiza el label desde children, no desde una prop label (TS-1)', () => {
    render(<Button>Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('aplica el variant primary por defecto (TS-2)', () => {
    render(<Button>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button.className).toMatch(/primary/);
    expect(button.className).not.toMatch(/secondaryNav|secondaryDismiss|session|flow/);
  });

  it('distingue los dos secundarios (TS-3)', () => {
    const { rerender } = render(<Button variant="secondary-nav">Volver</Button>);
    const nav = screen.getByRole('button', { name: 'Volver' });
    const navClass = nav.className;

    rerender(<Button variant="secondary-dismiss">Cancelar</Button>);
    const dismiss = screen.getByRole('button', { name: 'Cancelar' });

    expect(navClass).not.toBe(dismiss.className);
  });

  it('en loading marca aria-busy y no muestra el label como texto plano (TS-4)', () => {
    render(<Button loading>Guardar</Button>);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Guardar')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('en loading no dispara onClick (TS-5)', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Guardar
      </Button>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('deshabilitado marca aria-disabled y no dispara onClick (TS-6)', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('dispara onClick en el camino feliz (TS-7)', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('se activa con teclado (TS-8)', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    await userEvent.tab();
    const button = screen.getByRole('button');
    expect(button).toHaveFocus();

    await userEvent.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('el FAB exige aria-label y lo expone (TS-9)', () => {
    render(<Button variant="primary" fab aria-label="Agregar requisito" icon="mas" />);

    expect(screen.getByRole('button', { name: 'Agregar requisito' })).toBeInTheDocument();
  });

  it('en flow pone el icono a la derecha (TS-10)', () => {
    const { container } = render(
      <Button variant="flow" icon="flecha" iconTrailing>
        Pasar a revisión
      </Button>,
    );

    const button = container.querySelector('button')!;
    const children = Array.from(button.children);
    const labelIndex = children.findIndex((el) => el.textContent === 'Pasar a revisión');
    const iconIndex = children.findIndex((el) => el.textContent === 'flecha');

    expect(iconIndex).toBeGreaterThan(labelIndex);
  });

  it('ButtonProps no declara size (TS-11)', () => {
    // @ts-expect-error — size fue eliminado de la API en el cambio breaking del spec v2.0.1
    const el = <Button size="small">Guardar</Button>;
    expect(el).toBeDefined();
  });
});
