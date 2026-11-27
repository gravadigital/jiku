import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useUpdateObjectiveModule from '@/features/objectives/hooks/useUpdateObjective';
import { FinishDateLabel } from './FinishDateLabel';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@/features/objectives/hooks/useUpdateObjective');

const mockUpdateMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUpdateObjectiveModule.useUpdateObjective).mockReturnValue({
    mutate: mockUpdateMutate,
  } as any);
});

describe('FinishDateLabel', () => {
  it('TS-16 (S-067): actualizar la fecha dispara toast "Se cambió la fecha de finalización de la tarea"', async () => {
    const { toast } = await import('react-toastify');
    mockUpdateMutate.mockImplementation((_vars: any, options: any) => {
      options?.onSuccess?.();
    });

    const portalContainer = document.createElement('div');
    document.body.appendChild(portalContainer);

    render(
      <FinishDateLabel
        area="desarrollo"
        cardClass="default"
        description={null}
        estimatedFinishDate={new Date('2026-08-01')}
        finishedAt={null}
        objectiveId={1}
        persons={[]}
        portalContainer={portalContainer}
        priority={0}
        state="activo"
        title="Tarea de prueba"
      />
    );

    fireEvent.click(screen.getByText('Cierra en'));

    // Has to be a day other than the selected one: react-datepicker only fires
    // onChange when the date actually changes, so clicking the already-selected
    // day updates nothing. Which day is selected depends on the machine's
    // timezone — `new Date('2026-08-01')` is midnight UTC, so it lands on Jul 31
    // west of Greenwich and on Aug 1 in CI — hence picking by exclusion rather
    // than by a fixed date.
    const dayButton = portalContainer.querySelector(
      '.react-datepicker__day:not(.react-datepicker__day--selected):not(.react-datepicker__day--outside-month)'
    ) as HTMLElement;
    fireEvent.click(dayButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Se cambió la fecha de finalización de la tarea');
    });

    document.body.removeChild(portalContainer);
  });
});
