import { render, screen, act } from '@testing-library/react';
import { ToastContainer, showToast } from '@/shared/components/ui/Toast/Toast';
import { vi } from 'vitest';

describe('Toast system', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('showToast de tipo error muestra toast con role="alert"', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Error de prueba');
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error de prueba')).toBeInTheDocument();
  });

  it('showToast de tipo success muestra toast con role="alert"', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Éxito de prueba', 'success');
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Éxito de prueba')).toBeInTheDocument();
  });

  it('showToast sin tipo usa error por defecto (no-regresión)', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Error por defecto');
    });

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.className).toMatch(/error/);
  });

  it('showToast con tipo success aplica clase success', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Objetivo actualizado correctamente', 'success');
    });

    const alert = screen.getByRole('alert');
    expect(alert.className).toMatch(/success/);
  });
});
