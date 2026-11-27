import { render, screen } from '@testing-library/react';
import { Spinner } from '@/shared/components/ui/Spinner';

describe('Spinner', () => {
  it('renderiza con tamaño md por defecto', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('data-size', 'md');
  });

  it('renderiza con tamaño sm', () => {
    render(<Spinner size="sm" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('data-size', 'sm');
  });

  it('renderiza con tamaño lg', () => {
    render(<Spinner size="lg" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('data-size', 'lg');
  });

  it('tiene aria-label para accesibilidad', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Cargando');
  });
});
