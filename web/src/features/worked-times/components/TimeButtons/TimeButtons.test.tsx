import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHoursPerDay } from '@/features/time-allocation/hooks/useHoursPerDay';
import { TimeButtons } from './TimeButtons';

vi.mock('@/features/time-allocation/hooks/useHoursPerDay', () => ({
  useHoursPerDay: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));

const mockedUseHoursPerDay = vi.mocked(useHoursPerDay);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const defaultProps = {
  selectedHours: 0,
  selectedMinutes: 0,
  onHoursChange: vi.fn(),
  onMinutesChange: vi.fn(),
  onSubmit: vi.fn(),
  canSubmit: true,
  isSubmitting: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseHoursPerDay.mockReturnValue({ data: { hoursPerDay: 6 } } as any);
});

describe('TimeButtons', () => {
  it('TS-86: las opciones de horas y minutos son role="radio" dentro de sus role="radiogroup"', () => {
    render(<TimeButtons {...defaultProps} />, { wrapper: createWrapper() });

    const groups = screen.getAllByRole('radiogroup');
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
  });

  it('TS-86: al elegir "Otro" aparece un campo con label asociado (Input del DS)', async () => {
    const user = userEvent.setup();
    render(<TimeButtons {...defaultProps} />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('radio', { name: 'Otro' }));

    expect(screen.getByLabelText(/valor libre/i)).toBeInTheDocument();
  });

  it('no quedan <button> crudos ni <input> crudo: usa Button del DS para enviar', () => {
    const { container } = render(<TimeButtons {...defaultProps} />, { wrapper: createWrapper() });
    expect(container.querySelector('input[type="number"]')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar horas' })).toBeInTheDocument();
  });

  it('el botón de enviar respeta canSubmit y loading', () => {
    render(<TimeButtons {...defaultProps} canSubmit={false} />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: 'Cargar horas' })).toBeDisabled();
  });

  it('elegir una hora dispara onHoursChange', async () => {
    const user = userEvent.setup();
    const onHoursChange = vi.fn();
    render(<TimeButtons {...defaultProps} onHoursChange={onHoursChange} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('radio', { name: '2' }));
    expect(onHoursChange).toHaveBeenCalledWith(2);
  });

  it('elegir un minuto dispara onMinutesChange', async () => {
    const user = userEvent.setup();
    const onMinutesChange = vi.fn();
    render(<TimeButtons {...defaultProps} onMinutesChange={onMinutesChange} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole('radio', { name: '30' }));
    expect(onMinutesChange).toHaveBeenCalledWith(30);
  });

  it('muestra el total de tiempo elegido', () => {
    render(<TimeButtons {...defaultProps} selectedHours={4} selectedMinutes={30} />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText(/4h 30min/)).toBeInTheDocument();
  });
});
