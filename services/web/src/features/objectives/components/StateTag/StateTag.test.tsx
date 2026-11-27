import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useUpdateObjectiveModule from '@/features/objectives/hooks/useUpdateObjective';
import { StateTag } from './StateTag';

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

describe('StateTag', () => {
  it('TS-15 (S-067): cambiar el estado dispara toast "Se cambió el estado de la tarea a {valor}"', async () => {
    const { toast } = await import('react-toastify');
    mockUpdateMutate.mockImplementation((_vars: any, options: any) => {
      options?.onSuccess?.();
    });
    const user = userEvent.setup();

    render(
      <StateTag
        area="desarrollo"
        description={null}
        estimatedFinishDate={null}
        objectiveId={1}
        persons={[]}
        priority={0}
        state="activo"
        title="Tarea de prueba"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Estado: Activo' }));
    await user.click(screen.getByRole('option', { name: 'Backlog' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Se cambió el estado de la tarea a backlog');
    });
  });

  it('S-056 TS-3: usa Badge del DS con family de la familia correspondiente al estado', () => {
    render(
      <StateTag
        area="desarrollo"
        description={null}
        estimatedFinishDate={null}
        objectiveId={1}
        persons={[]}
        priority={0}
        state="finalizado"
        title="Tarea de prueba"
      />
    );

    const button = screen.getByRole('button', { name: 'Estado: Finalizado' });
    expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    expect(button.className).toMatch(/familyResolved/);
  });
});
