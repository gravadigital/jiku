import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    fireEvent.click(screen.getByRole('button', { name: 'Activo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Se cambió el estado de la tarea a backlog');
    });
  });
});
