import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as usePersonsModule from '@/features/auth/hooks/usePersons';
import * as useCreateObjectiveModule from '@/features/objectives/hooks/useCreateObjective';
import * as useProjectsModule from '@/features/projects/hooks/useProjects';
import * as useRequirementsModule from '@/features/requirements/hooks/useRequirements';
import Form from './page';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
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

vi.mock('@/shared/components/ui/InputMultiplePersons/InputMultiplePersons', () => ({
  InputMultiplePersons: ({
    label,
    code,
    onChange,
    options,
  }: {
    label: string;
    code: string;
    onChange: (v: { label: string; value: string }[]) => void;
    options?: { label: string; value: string }[];
  }) => (
    <div>
      <label htmlFor={code}>{label}</label>
      <select
        id={code}
        multiple
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map((o) => ({
            label: o.textContent ?? '',
            value: o.value,
          }));
          onChange(selected);
        }}
      >
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
vi.mock('@/features/projects/hooks/useProjects');
vi.mock('@/features/requirements/hooks/useRequirements');
vi.mock('@/features/objectives/hooks/useCreateObjective');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function createWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { Wrapper, queryClient };
}

const mockMutateAsync = vi.fn();

describe('Objectives new/page — campo Requisito (AC-7, AC-9, AC-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(usePersonsModule.usePersons).mockReturnValue({
      data: [{ id: 1, firstName: 'Ana', lastName: 'Pérez' }],
      isLoading: false,
    } as any);
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      data: [
        { id: 5, name: 'Proyecto Alpha' },
        { id: 6, name: 'Proyecto Beta' },
      ],
      isLoading: false,
    } as any);
    vi.mocked(useRequirementsModule.useRequirements).mockReturnValue({
      data: [{ id: 12, title: 'REQ-12 Bug login', projectId: 5 }],
    } as any);
    vi.mocked(useCreateObjectiveModule.useCreateObjective).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);
    mockMutateAsync.mockResolvedValue({});
  });

  it('AC-7: muestra el selector "Requisito" cuando hay un proyecto seleccionado', () => {
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });

    expect(screen.getByText('Requisito')).toBeInTheDocument();
  });

  it('TS-15 (AC-7): selector Requisito consulta useRequirements filtrado por projectId', () => {
    render(<Form />, { wrapper: createWrapper() });

    const projectSelect = document.getElementById('projectId') as HTMLSelectElement;
    fireEvent.change(projectSelect, { target: { value: '5' } });

    expect(useRequirementsModule.useRequirements).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ projectId: 5 }) })
    );
  });

  it('TS-10 (AC-7): guardar con requisito seleccionado incluye requirementId en el payload', async () => {
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Fix login' },
    });
    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });
    fireEvent.change(document.getElementById('requirementId') as HTMLSelectElement, {
      target: { value: '12' },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload.requirementId).toBe(12);
  });

  it('TS-13 (AC-10): guardar sin requisito no incluye requirementId en el payload', async () => {
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Nueva tarea' },
    });
    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload.requirementId).toBeUndefined();
  });

  it('cambiar de proyecto limpia la selección de Requisito', () => {
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });
    fireEvent.change(document.getElementById('requirementId') as HTMLSelectElement, {
      target: { value: '12' },
    });
    expect((document.getElementById('requirementId') as HTMLSelectElement).value).toBe('12');

    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '6' },
    });
    expect((document.getElementById('requirementId') as HTMLSelectElement).value).toBe('');
  });

  // TS-11 (AC-8): autocompletado al crear objetivo desde un requisito
  it('TS-11 (AC-8): precarga projectId y requirementId desde los query params', () => {
    mockSearchParams = new URLSearchParams({ projectId: '5', requirementId: '12' });
    render(<Form />, { wrapper: createWrapper() });

    expect((document.getElementById('projectId') as HTMLSelectElement).value).toBe('5');
    expect((document.getElementById('requirementId') as HTMLSelectElement).value).toBe('12');
  });

  // TS-14: error requirement_project_mismatch muestra el mensaje del backend
  it('TS-14: requirement_project_mismatch muestra el mensaje de error del backend', async () => {
    const { toast } = await import('react-toastify');
    mockMutateAsync.mockRejectedValue({
      code: 'requirement_project_mismatch',
      message: 'El requisito no pertenece al mismo proyecto',
    });

    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Fix login' },
    });
    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });
    fireEvent.change(document.getElementById('requirementId') as HTMLSelectElement, {
      target: { value: '12' },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('El requisito no pertenece al mismo proyecto');
    });
  });

  it('TS-5 (S-067): muestra título "Tareas / crear" y placeholder "Título de la tarea"', () => {
    render(<Form />, { wrapper: createWrapper() });

    expect(screen.getByText('Tareas / crear')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Título de la tarea')).toBeInTheDocument();
  });

  it('TS-6 (S-067): crear con éxito dispara toast "Tareas creadas con éxito"', async () => {
    const { toast } = await import('react-toastify');
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Fix login' },
    });
    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Tareas creadas con éxito');
    });
  });

  it('TS-7 (S-067): error sin mensaje dispara toast "Error al crear algunas tareas"', async () => {
    const { toast } = await import('react-toastify');
    mockMutateAsync.mockRejectedValue({});

    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Fix login' },
    });
    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error al crear algunas tareas');
    });
  });

  // S-091 (CA-2, TS-1): redirect al requisito de origen tras crear con éxito, viniendo con ?requirementId
  it('S-091 TS-1: crear con éxito viniendo con requirementId en la URL redirige a /requirements/{id}', async () => {
    mockSearchParams = new URLSearchParams({ requirementId: '42', projectId: '5' });
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Fix login' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/requirements/42');
    });
    expect(mockPush).not.toHaveBeenCalledWith('/objectives');
  });

  // S-091 (bug reportado tras QA manual): al volver al requisito de origen, la Card Tareas no
  // reflejaba la tarea recién creada porque RequirementDetailContainer usa useRequirement con
  // initialData (del Server Component), que React Query nunca refetchea sin invalidación
  // explícita — la creación ocurre en otra pantalla, así que ninguna invalidación llegaba.
  it('S-091: crear con éxito viniendo con requirementId invalida la query ["requirement", id]', async () => {
    mockSearchParams = new URLSearchParams({ requirementId: '42', projectId: '5' });
    const { Wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    render(<Form />, { wrapper: Wrapper });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Fix login' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['requirement', 42] });
    });
  });

  // S-091 (CA-3, TS-2): sin requirementId en la URL, comportamiento sin cambios
  it('S-091 TS-2: crear con éxito sin requirementId en la URL sigue redirigiendo a /objectives', async () => {
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Nueva tarea' },
    });
    fireEvent.change(document.getElementById('projectId') as HTMLSelectElement, {
      target: { value: '5' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/objectives');
    });
  });

  // S-091 (CA-2, TS-3, edge case): batch de 2 tareas clonadas, viniendo con requirementId en la URL
  it('S-091 TS-3: batch de tareas clonadas viniendo con requirementId en la URL redirige al requisito de origen', async () => {
    mockSearchParams = new URLSearchParams({ requirementId: '42', projectId: '5' });
    render(<Form />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByPlaceholderText('Título de la tarea'), {
      target: { value: 'Primera tarea' },
    });
    fireEvent.change(document.getElementById('personIds') as HTMLSelectElement, {
      target: { selectedIndex: 0 },
    });

    fireEvent.click(screen.getByText('Clonar'));

    const titleInputs = screen.getAllByPlaceholderText('Título de la tarea');
    fireEvent.change(titleInputs[1], { target: { value: 'Segunda tarea' } });
    const personSelects = document.querySelectorAll('#personIds') as NodeListOf<HTMLSelectElement>;
    fireEvent.change(personSelects[1], { target: { selectedIndex: 0 } });

    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    });
    expect(mockPush).toHaveBeenCalledWith('/requirements/42');
  });
});
