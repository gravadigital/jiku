import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCreateWorkedTime } from '../../hooks/useCreateWorkedTime';
import { WorkedTimesPage } from './WorkedTimesPage';
import type { TargetSelection } from '../../types/worked-time.types';

// --- Infra mocks (next-auth / navigation / toast) ---
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { roles: [], zitadelId: 'z1' } } })),
}));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- Data hooks mocks ---
vi.mock('@/features/auth/hooks/usePersons', () => ({
  usePersons: vi.fn(() => ({
    data: [{ id: 1, userId: 'z1', firstName: 'A', lastName: 'B', enabled: true }],
  })),
}));
vi.mock('@/features/time-allocation/hooks/useHoursPerDay', () => ({
  useHoursPerDay: vi.fn(() => ({ data: { hoursPerDay: 6 } })),
}));
vi.mock('../../hooks/useUnworkedTimesReasons', () => ({
  useUnworkedTimesReasons: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('../../hooks/useUnworkedTimesReport', () => ({
  useUnworkedTimesReport: vi.fn(() => ({ data: [] })),
}));
vi.mock('../../hooks/useWorkedTimesRange', () => ({
  useWorkedTimesRange: vi.fn(() => ({ data: [] })),
}));
vi.mock('../../hooks/useCreateUnworkedTime', () => ({
  useCreateUnworkedTime: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));
vi.mock('../../hooks/useCreateWorkedTime', () => ({
  useCreateWorkedTime: vi.fn(),
}));

// --- Child component stubs to control state deterministically ---
vi.mock('../DayEntriesList', () => ({
  DayEntriesList: () => <div data-testid="day-entries" />,
}));
vi.mock('../DaySelector', () => ({
  DaySelector: () => <div data-testid="day-selector" />,
}));
vi.mock('../TargetSelector', () => ({
  TargetSelector: ({ onSelect }: { onSelect: (s: TargetSelection | null) => void }) => (
    <div>
      <button
        type="button"
        data-testid="pick-target"
        onClick={() =>
          onSelect({ projectId: 3, projectName: 'P3', requirementId: 5, objectiveId: null })
        }
      >
        pick-target
      </button>
      <button
        type="button"
        data-testid="pick-target-objective"
        onClick={() => onSelect({ projectId: 1, requirementId: null, objectiveId: 10 })}
      >
        pick-target-objective
      </button>
      <button
        type="button"
        data-testid="pick-target-project-only"
        onClick={() =>
          onSelect({ projectId: 1, projectName: 'P1', requirementId: null, objectiveId: null })
        }
      >
        pick-target-project-only
      </button>
    </div>
  ),
}));
vi.mock('../TimeButtons', () => ({
  TimeButtons: ({
    onHoursChange,
    onSubmit,
    canSubmit,
  }: {
    onHoursChange: (h: number) => void;
    onSubmit: () => void;
    canSubmit: boolean;
  }) => (
    <div>
      <button type="button" data-testid="set-hours" onClick={() => onHoursChange(1)}>
        set-hours
      </button>
      <button type="button" data-testid="submit" disabled={!canSubmit} onClick={onSubmit}>
        submit
      </button>
    </div>
  ),
}));

const mockedUseCreateWorkedTime = vi.mocked(useCreateWorkedTime);

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

// mutate(payload, {onSuccess, onError}) — el comportamiento se inyecta por test.
type MutateOpts = {
  onSuccess?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any) => void;
};

beforeEach(() => {
  vi.clearAllMocks();
});

async function arrangeAndSubmit(mutate: ReturnType<typeof vi.fn>) {
  mockedUseCreateWorkedTime.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { mutate, isPending: false } as any
  );
  const user = userEvent.setup();
  render(<WorkedTimesPage />, { wrapper: createWrapper() });
  await user.click(screen.getByTestId('pick-target')); // selecciona {projectId:3, requirementId:5}
  await user.click(screen.getByTestId('set-hours')); // 1h = 60min
  await user.click(screen.getByTestId('submit'));
  return user;
}

describe('WorkedTimesPage — S-055', () => {
  // TS-9 (integración): payload requisito armado por la página
  it('TS-9: submit con {projectId:3, requirementId:5} envía payload con requirementId y sin objectiveId', async () => {
    const mutate = vi.fn();
    await arrangeAndSubmit(mutate);

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0];
    expect(payload).toMatchObject({ minutes: 60, projectId: 3, requirementId: 5 });
    expect(payload).not.toHaveProperty('objectiveId');
  });

  // TS-15: Error backend (400) no limpia datos
  it('TS-15: error requirement_project_mismatch muestra toast.error y no limpia el destino', async () => {
    const mutate = vi.fn((_payload, opts: MutateOpts) => {
      opts.onError?.({
        code: 'requirement_project_mismatch',
        message: 'El requisito pertenece a otro proyecto',
        status: 400,
      });
    });
    const user = await arrangeAndSubmit(mutate);

    expect(toast.error).toHaveBeenCalledWith('El requisito pertenece a otro proyecto');
    expect(toast.success).not.toHaveBeenCalled();

    // Re-submit: el destino y los minutos siguen presentes (no se reseteó nada).
    mutate.mockClear();
    await user.click(screen.getByTestId('submit'));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({ minutes: 60, projectId: 3, requirementId: 5 });
  });

  // TS-16: Error 403 rol insuficiente no limpia datos
  it('TS-16: error access_denied (403) muestra toast.error y no limpia datos', async () => {
    const mutate = vi.fn((_payload, opts: MutateOpts) => {
      opts.onError?.({ code: 'access_denied', message: 'Access denied', status: 403 });
    });
    const user = await arrangeAndSubmit(mutate);

    expect(toast.error).toHaveBeenCalledWith('Access denied');

    mutate.mockClear();
    await user.click(screen.getByTestId('submit'));
    expect(mutate.mock.calls[0][0]).toMatchObject({ minutes: 60, projectId: 3, requirementId: 5 });
  });

  // TS-17: Éxito limpia el formulario
  it('TS-17: éxito muestra toast.success y resetea destino y minutos', async () => {
    const mutate = vi.fn((_payload, opts: MutateOpts) => {
      opts.onSuccess?.();
    });
    const user = await arrangeAndSubmit(mutate);

    expect(toast.success).toHaveBeenCalledWith('Horas cargadas exitosamente');

    // Tras el reset, el botón submit queda deshabilitado (sin destino ni minutos).
    mutate.mockClear();
    expect(screen.getByTestId('submit')).toBeDisabled();
    await user.click(screen.getByTestId('submit'));
    expect(mutate).not.toHaveBeenCalled();
  });

  // TS-10: submit con tarea elegida envía objectiveId sin requirementId
  it('TS-10: submit con {projectId:1, objectiveId:10} envía payload con objectiveId y sin requirementId', async () => {
    const mutate = vi.fn();
    mockedUseCreateWorkedTime.mockReturnValue({ mutate, isPending: false } as any);
    const user = userEvent.setup();
    render(<WorkedTimesPage />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('pick-target-objective'));
    await user.click(screen.getByTestId('set-hours'));
    await user.click(screen.getByTestId('submit'));

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0];
    expect(payload).toMatchObject({ minutes: 60, projectId: 1, objectiveId: 10 });
    expect(payload).not.toHaveProperty('requirementId');
  });

  // TS-11: submit con solo proyecto elegido envía solo projectId
  it('TS-11: submit con {projectId:1} (solo proyecto) envía payload sin objectiveId ni requirementId', async () => {
    const mutate = vi.fn();
    mockedUseCreateWorkedTime.mockReturnValue({ mutate, isPending: false } as any);
    const user = userEvent.setup();
    render(<WorkedTimesPage />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId('pick-target-project-only'));
    await user.click(screen.getByTestId('set-hours'));
    await user.click(screen.getByTestId('submit'));

    expect(mutate).toHaveBeenCalledTimes(1);
    const payload = mutate.mock.calls[0][0];
    expect(payload).toMatchObject({ minutes: 60, projectId: 1 });
    expect(payload).not.toHaveProperty('objectiveId');
    expect(payload).not.toHaveProperty('requirementId');
  });
});
