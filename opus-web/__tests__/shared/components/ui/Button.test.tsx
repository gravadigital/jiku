import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/shared/components/ui/Button';
import { vi } from 'vitest';

describe('Button', () => {
  it('renderiza correctamente con variante primary', () => {
    render(<Button variant="primary">Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-variant', 'primary');
  });

  it('renderiza correctamente con variante secondary', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toHaveAttribute('data-variant', 'secondary');
  });

  it('renderiza correctamente con variante danger', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button', { name: 'Danger' });
    expect(button).toHaveAttribute('data-variant', 'danger');
  });

  it('muestra Spinner cuando loading=true', () => {
    render(<Button loading>Loading</Button>);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  it('está deshabilitado cuando disabled=true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
  });

  it('está deshabilitado cuando loading=true', () => {
    render(<Button loading>Loading</Button>);
    // Con loading el botón reemplaza sus children por el Spinner, cuyo aria-label
    // pasa a ser el nombre accesible: por eso no se lo busca por "Loading".
    const button = screen.getByRole('button', { name: /cargando/i });
    expect(button).toBeDisabled();
  });

  it('llama onClick cuando se hace click', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('no llama onClick cuando está deshabilitado', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Click me
      </Button>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renderiza con tamaño sm', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button', { name: 'Small' });
    expect(button).toHaveAttribute('data-size', 'sm');
  });

  it('renderiza con tamaño lg', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button', { name: 'Large' });
    expect(button).toHaveAttribute('data-size', 'lg');
  });
});
