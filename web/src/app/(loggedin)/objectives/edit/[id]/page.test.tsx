import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as usePersonsModule from '@/features/auth/hooks/usePersons';
import * as useObjectiveModule from '@/features/objectives/hooks/useObjective';
import * as useUpdateObjectiveModule from '@/features/objectives/hooks/useUpdateObjective';
import * as useRequirementsModule from '@/features/requirements/hooks/useRequirements';
import ObjectiveEdition from './page';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('@/shared/components/ui/InputSelect/InputSelect', () => ({
  InputSelect: ({
    label,
    code,
    value,
    onChange,
    options,
  }: {
    label: string;
    code: string;
    value: string;
    onChange: (v: string) => void;
    options?: { label: string; value: string }[];
  }) => (
    <div>
      <label htmlFor={code}>{label}</label>
      <select id={code} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock('@/features/auth/hooks/usePersons');
vi.mock('@/features/objectives/hooks/useObjective');
vi.mock('@/features/objectives/hooks/useUpdateObjective');
vi.mock('@/features/requirements/hooks/useRequirements');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const mockUpdateMutate = vi.fn();

const baseObjective = {
  id: 30,
  area: 'desarrollo',
  description: '',
  estimatedFinishDate: null,
  persons: [{ id: 1, firstName: 'Ana', lastName: 'Pérez', PersonObjective: { isLeader: true } }],
  priority: 1,
  project: { name: 'Proyecto Alpha' },
  projectId: 5,
  requirementId: null,
  stageId: null,
  state: 'activo',
  title: 'Objetivo de prueba',
  visibilityLevel: 'internal',
};

describe('Objectives edit/[id]/page — campo Requisito (AC-7, AC-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePersonsModule.usePersons).mockReturnValue({
      data: [{ id: 1, firstName: 'Ana', lastName: 'Pérez' }],
      isLoading: false,
    } as any);
    vi.mocked(useObjectiveModule.useObjective).mockReturnValue({
      data: baseObjective,
      isLoading: false,
    } as any);
    vi.mocked(useRequirementsModule.useRequirements).mockReturnValue({
      data: [
        { id: 12, title: 'REQ-12 Bug login', projectId: 5 },
        { id: 15, title: 'REQ-15 Otro', projectId: 5 },
      ],
    } as any);
    vi.mocked(useUpdateObjectiveModule.useUpdateObjective).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    } as any);
  });

  it('AC-7: muestra el selector "Requisito" filtrado por el projectId del objetivo', async () => {
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Requisito')).toBeInTheDocument();
    });
    expect(useRequirementsModule.useRequirements).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ projectId: 5 }) })
    );
  });

  it('AC-9: si el objetivo ya tiene requirementId, el selector lo inicializa', async () => {
    vi.mocked(useObjectiveModule.useObjective).mockReturnValue({
      data: { ...baseObjective, requirementId: 12 },
      isLoading: false,
    } as any);
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect((document.getElementById('requirementId') as HTMLSelectElement).value).toBe('12');
    });
  });

  it('AC-9: cambiar el requisito y guardar reemplaza el vínculo sin confirmación adicional', async () => {
    vi.mocked(useObjectiveModule.useObjective).mockReturnValue({
      data: { ...baseObjective, requirementId: 12 },
      isLoading: false,
    } as any);
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(document.getElementById('requirementId')).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById('requirementId') as HTMLSelectElement, {
      target: { value: '15' },
    });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 30,
          payload: expect.objectContaining({
            requirementId: 15,
            title: baseObjective.title,
            area: baseObjective.area,
            priority: baseObjective.priority.toString(),
            state: baseObjective.state,
            visibilityLevel: baseObjective.visibilityLevel,
          }),
        }),
        expect.anything()
      );
    });
  });

  // TS-6: desvincular el requisito envía null explícito
  it('TS-6: selector "Requisito" incluye la opción "Sin requisito"', async () => {
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(document.getElementById('requirementId')).toBeInTheDocument();
    });

    const select = document.getElementById('requirementId') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.textContent);
    expect(options).toContain('Sin requisito');
  });

  it('TS-6: desvincular un requisito previamente asignado envía requirementId: null', async () => {
    vi.mocked(useObjectiveModule.useObjective).mockReturnValue({
      data: { ...baseObjective, requirementId: 12 },
      isLoading: false,
    } as any);
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect((document.getElementById('requirementId') as HTMLSelectElement).value).toBe('12');
    });

    fireEvent.change(document.getElementById('requirementId') as HTMLSelectElement, {
      target: { value: '' },
    });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 30,
          payload: expect.objectContaining({ requirementId: null }),
        }),
        expect.anything()
      );
    });
  });

  it('TS-3 (caso base): objetivo sin requirementId inicial, guardar sin tocar el selector no incluye requirementId', async () => {
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(document.getElementById('requirementId')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalled();
    });

    const [callArgs] = mockUpdateMutate.mock.calls[0];
    expect(callArgs.payload).not.toHaveProperty('requirementId');
  });

  // TS-14: error requirement_project_mismatch muestra mensaje y no actualiza
  it('TS-14: requirement_project_mismatch muestra el mensaje de error del backend', async () => {
    const { toast } = await import('react-toastify');
    mockUpdateMutate.mockImplementation((_vars: any, options: any) => {
      options?.onError?.({
        code: 'requirement_project_mismatch',
        message: 'El requisito no pertenece al mismo proyecto',
      });
    });
    vi.mocked(useObjectiveModule.useObjective).mockReturnValue({
      data: { ...baseObjective, requirementId: 12 },
      isLoading: false,
    } as any);
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(document.getElementById('requirementId')).toBeInTheDocument();
    });

    fireEvent.change(document.getElementById('requirementId') as HTMLSelectElement, {
      target: { value: '15' },
    });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('El requisito no pertenece al mismo proyecto');
    });
  });

  it('TS-8 (S-067): muestra título "Tareas / editar" y placeholders "de la tarea"', async () => {
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Tareas / editar')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Título de la tarea')).toBeInTheDocument();
  });

  it('TS-8 (S-067): guardar con éxito dispara toast "Tarea editada con éxito"', async () => {
    const { toast } = await import('react-toastify');
    mockUpdateMutate.mockImplementation((_vars: any, options: any) => {
      options?.onSuccess?.();
    });
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Guardar')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Tarea editada con éxito');
    });
  });

  it('TS-9 (S-067): error genérico dispara toast "Hubo un error al editar la tarea"', async () => {
    const { toast } = await import('react-toastify');
    mockUpdateMutate.mockImplementation((_vars: any, options: any) => {
      options?.onError?.({});
    });
    await act(async () => {
      render(<ObjectiveEdition params={Promise.resolve({ id: 30 })} />, {
        wrapper: createWrapper(),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Guardar')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Hubo un error al editar la tarea');
    });
  });
});
