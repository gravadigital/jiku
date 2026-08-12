import React, { forwardRef, useImperativeHandle } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as usePersonsModule from '@/features/auth/hooks/usePersons';
import * as useRequirementTagSuggestionsModule from '../../hooks/useRequirementTagSuggestions';
import * as useUpdateRequirementModule from '../../hooks/useUpdateRequirement';
import { EditRequirementForm } from './EditRequirementForm';
import type { Requirement } from '../../types/requirement.types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null })),
}));

vi.mock('../../hooks/useUpdateRequirement');
vi.mock('@/features/auth/hooks/usePersons');
vi.mock('../../hooks/useRequirementTagSuggestions');

vi.mock('../RequirementRichTextEditor', () => ({
  RequirementRichTextEditor: forwardRef(function MockEditor(
    props: {
      ariaLabel?: string;
      onChange?: (v: string) => void;
      onRemoveAttachment?: (id: number) => void;
    },
    ref: React.Ref<unknown>
  ) {
    useImperativeHandle(ref, () => ({
      getValue: () => '',
      clear: () => props.onChange?.(''),
      insertAttachment: () => true,
      removeAttachment: () => {},
      focus: () => {},
    }));
    return (
      <textarea aria-label={props.ariaLabel} onChange={(e) => props.onChange?.(e.target.value)} />
    );
  }),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockMutate = vi.fn();

const mockRequirement: Requirement = {
  id: 42,
  title: 'Requisito de prueba',
  description: 'Descripción inicial',
  type: 'mejora',
  priority: 'alta',
  state: 'analisis',
  visibilityLevel: 'public',
  estimatedFinishDate: '2026-09-01',
  projectId: 1,
  project: { id: 1, name: 'Proyecto Alpha' },
  responsiblePeople: [],
  createdBy: 'usuario@test.com',
  creator: { id: 'u1', name: 'Usuario Test', email: 'usuario@test.com' },
  tags: [{ key: 'env', value: 'prod' }],
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-06-01T12:00:00Z',
  scope: null,
  technicalSolution: null,
  acceptanceCriteria: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('EditRequirementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useUpdateRequirementModule.useUpdateRequirement).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    vi.mocked(usePersonsModule.usePersons).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.mocked(useRequirementTagSuggestionsModule.useRequirementTagSuggestions).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
  });

  // TS-08: labels tienen font-weight 400 — el componente renderiza labels accesibles con las clases correctas
  it('TS-08: labels del formulario de edición están presentes como elementos label', () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    // CA-2: labels con font-weight: 400 en SCSS. Verificamos que los labels se renderizan correctamente.
    expect(screen.getByText(/^título/i).tagName.toLowerCase()).toBe('label');
    expect(screen.getByText(/^proyecto/i).tagName.toLowerCase()).toBe('label');
    expect(screen.getByText(/^tipo/i).tagName.toLowerCase()).toBe('label');
  });

  // TS-05: campos se precargan con los valores del requisito
  it('TS-05: precarga título, tipo y prioridad del requisito', () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText(/^título/i)).toHaveValue('Requisito de prueba');
    expect(screen.getByText('Mejora')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  // TS-06: campo Proyecto es read-only
  it('TS-06: el campo Proyecto está deshabilitado', () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    const proyectoInput = screen.getByLabelText(/proyecto/i);
    expect(proyectoInput).toBeDisabled();
  });

  // TS-07: submit llama a useUpdateRequirement con el payload correcto
  it('TS-07: submit válido invoca updateRequirement con reqid y payload correctos', async () => {
    mockMutate.mockImplementation((_params: any, options: any) => {
      options?.onSuccess?.();
    });
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/^título/i), {
      target: { value: 'Título actualizado' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          reqid: 42,
          payload: expect.objectContaining({
            title: 'Título actualizado',
            type: 'mejora',
          }),
        }),
        expect.any(Object)
      );
    });
  });

  // TS-07 continuación: redirige a /requirements/[reqid] en éxito
  it('redirige a /requirements/42 tras guardar exitoso', async () => {
    mockMutate.mockImplementation((_params: any, options: any) => {
      options?.onSuccess?.();
    });
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/requirements/42');
    });
  });

  // TS-09: validación título requerido
  it('TS-09: título vacío muestra "(obligatorio)" y no llama a updateRequirement', async () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      const titleLabel = screen.getByText('Título', { exact: false }).closest('label');
      expect(titleLabel).toHaveTextContent('(obligatorio)');
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // S-088 (CA-3, TS-5): Título de solo espacios no pasa validación en edición
  it('TS-5: Título con solo espacios en blanco muestra "(obligatorio)" y no llama a updateRequirement', async () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      const titleLabel = screen.getByText('Título', { exact: false }).closest('label');
      expect(titleLabel).toHaveTextContent('(obligatorio)');
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // S-088 (CA-3, TS-13): Título con espacios circundantes y contenido real sigue siendo válido en edición
  it('TS-13: Título con espacios al inicio/fin y contenido real en el medio sigue siendo válido', async () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: '  Nuevo título  ' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ title: '  Nuevo título  ' }),
        }),
        expect.anything()
      );
    });
  });

  // S-088 (CA-6, TS-10): Tipo ya no es obligatorio — "Sin tipo" es un valor real y válido
  it('TS-10: guardar con "Sin tipo" seleccionado envía type: null y llama a updateRequirement', async () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });

    const tipoSelect = screen.getByLabelText(/^tipo/i);
    fireEvent.focus(tipoSelect);
    fireEvent.keyDown(tipoSelect, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Sin tipo'));

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ type: null }) }),
        expect.anything()
      );
    });
  });

  // S-088 (CA-7, TS-11): el Select Tipo precarga "Sin tipo" cuando requirement.type es null
  it('TS-11: precarga "Sin tipo" cuando requirement.type es null', () => {
    render(<EditRequirementForm requirement={{ ...mockRequirement, type: null }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Sin tipo')).toBeInTheDocument();
  });

  // S-088 (CA-6, no-regresión): seleccionar un tipo real sigue funcionando igual
  it('guardar con un tipo real seleccionado envía ese valor sin cambios', async () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ type: 'mejora' }) }),
        expect.anything()
      );
    });
  });

  // link Volver apunta a /requirements/[reqid]
  it('el link Volver apunta a /requirements/42', () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    const volver = screen.getByRole('link', { name: /volver/i });
    expect(volver).toHaveAttribute('href', '/requirements/42');
  });

  // etiqueta existente se muestra precargada
  it('muestra las etiquetas existentes del requisito', () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Eliminar tag env:prod')).toBeInTheDocument();
  });

  // TS-15/TS-17 (AC-11): multi-select de responsables
  describe('Responsable(s) — multi-select (AC-11)', () => {
    const requirementWithResponsables: Requirement = {
      ...mockRequirement,
      responsiblePeople: [
        { id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
        { id: 2, firstName: 'Juan', lastName: 'Gómez', isLeader: null },
      ],
    };

    beforeEach(() => {
      vi.mocked(usePersonsModule.usePersons).mockReturnValue({
        data: [
          { id: 1, firstName: 'Ana', lastName: 'Pérez' },
          { id: 2, firstName: 'Juan', lastName: 'Gómez' },
          { id: 3, firstName: 'Rita', lastName: 'Díaz' },
        ],
        isLoading: false,
      } as any);
    });

    it('se inicializa con todos los responsables existentes, no solo el líder', () => {
      render(<EditRequirementForm requirement={requirementWithResponsables} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
      expect(screen.getByText('Juan Gómez')).toBeInTheDocument();
    });

    // Corrige bug reportado: el líder no siempre viene primero en responsiblePeople[] (la API
    // no garantiza ese orden en el array), y la precarga del Select debe mostrarlo primero de
    // todos modos, igual que ya hace RequirementList/RequirementDetail.
    it('precarga al líder primero en el multi-select aunque venga después en responsiblePeople[]', async () => {
      const requirementLeaderNotFirst: Requirement = {
        ...mockRequirement,
        responsiblePeople: [
          { id: 2, firstName: 'Juan', lastName: 'Gómez', isLeader: null },
          { id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
        ],
      };
      mockMutate.mockImplementation((_params: any, options: any) => {
        options?.onSuccess?.();
      });
      render(<EditRequirementForm requirement={requirementLeaderNotFirst} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ responsiblePersonIds: [1, 2] }),
          }),
          expect.any(Object)
        );
      });
    });

    it('TS-15: cambiar la selección de responsables y guardar envía responsiblePersonIds actualizado', async () => {
      mockMutate.mockImplementation((_params: any, options: any) => {
        options?.onSuccess?.();
      });
      render(<EditRequirementForm requirement={requirementWithResponsables} />, {
        wrapper: createWrapper(),
      });

      const responsableSelect = screen.getByLabelText(/^responsable/i);
      fireEvent.focus(responsableSelect);
      fireEvent.keyDown(responsableSelect, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByText('Rita Díaz'));

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            reqid: 42,
            payload: expect.objectContaining({ responsiblePersonIds: [1, 2, 3] }),
          }),
          expect.any(Object)
        );
      });
    });

    // TS-16 (AC-11, Tarea 8): invalid_responsible_person muestra el mensaje del backend
    it('TS-16: invalid_responsible_person muestra toast de error y no navega', async () => {
      const { toast } = await import('react-toastify');
      mockMutate.mockImplementation((_params: any, options: any) => {
        options?.onError?.({ code: 'invalid_responsible_person', message: 'Responsable inválido' });
      });
      render(<EditRequirementForm requirement={requirementWithResponsables} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Responsable inválido');
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('TS-17: guardar sin tocar responsables igual incluye responsiblePersonIds con la lista actual', async () => {
      mockMutate.mockImplementation((_params: any, options: any) => {
        options?.onSuccess?.();
      });
      render(<EditRequirementForm requirement={requirementWithResponsables} />, {
        wrapper: createWrapper(),
      });

      fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: 'Otro título' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            reqid: 42,
            payload: expect.objectContaining({ responsiblePersonIds: [1, 2] }),
          }),
          expect.any(Object)
        );
      });
    });
  });

  it('TS-13: Select Estado muestra las 7 opciones, todas seleccionables (S-065/TS-13)', () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });

    const estadoSelect = screen.getByLabelText(/^estado/i);
    fireEvent.focus(estadoSelect);
    fireEvent.keyDown(estadoSelect, { key: 'ArrowDown' });

    const expectedLabels = [
      'Análisis',
      'Planificación',
      'En cola',
      'Desarrollo',
      'Revisión',
      'Resuelto',
      'Cancelado',
    ];
    expectedLabels.forEach((label) => {
      const matches = screen.getAllByText(label);
      expect(matches.length).toBeGreaterThan(0);
      matches.forEach((match) => {
        expect(match.closest('[aria-disabled="true"]')).toBeNull();
      });
    });
  });

  it('TS-14b: no incluye campos Alcance, Solución técnica ni Criterios de aceptación (S-065/TS-14b)', () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });

    expect(screen.queryByLabelText('Alcance')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Solución técnica')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Criterios de aceptación')).not.toBeInTheDocument();
  });

  it('TS-12: para type=incidencia, el Select Estado NO ofrece "En cola" (6 opciones)', () => {
    render(<EditRequirementForm requirement={{ ...mockRequirement, type: 'incidencia' }} />, {
      wrapper: createWrapper(),
    });

    const estadoSelect = screen.getByLabelText(/^estado/i);
    fireEvent.focus(estadoSelect);
    fireEvent.keyDown(estadoSelect, { key: 'ArrowDown' });

    expect(screen.queryByText('En cola')).not.toBeInTheDocument();
    ['Análisis', 'Planificación', 'Desarrollo', 'Revisión', 'Resuelto', 'Cancelado'].forEach(
      (label) => {
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      }
    );
  });

  it('TS-13/TS-14: cambiar Tipo a incidencia con state=en_cola ya cargado no lo limpia, pero deja de ofrecerlo', () => {
    render(
      <EditRequirementForm
        requirement={{ ...mockRequirement, type: 'funcionalidad', state: 'en_cola' }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('En cola')).toBeInTheDocument();

    const tipoSelect = screen.getByLabelText(/^tipo/i);
    fireEvent.focus(tipoSelect);
    fireEvent.keyDown(tipoSelect, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Incidencia'));

    // TS-13: el valor seleccionado del Select Estado sigue siendo "En cola", sin forzarse ni limpiarse.
    expect(screen.getByText('En cola')).toBeInTheDocument();

    // TS-14: al abrir el menú del Select Estado, "En cola" ya no aparece como opción del listado.
    const estadoSelect = screen.getByLabelText(/^estado/i);
    fireEvent.focus(estadoSelect);
    fireEvent.keyDown(estadoSelect, { key: 'ArrowDown' });

    const enColaMatches = screen.getAllByText('En cola');
    // Solo debe quedar el nodo que muestra el valor actual seleccionado (fuera del menú de opciones);
    // ninguno debe tener role="option".
    enColaMatches.forEach((match) => {
      expect(match.closest('[role="option"]')).toBeNull();
    });
  });

  // Fix drafts huérfanos + eliminación explícita: attachmentIds representa el
  // conjunto COMPLETO de ids vigentes en el texto — el backend deduce el diff
  // (confirma los nuevos, soft-elimina los que ya no están).
  it('guardar sin tocar la descripción envía attachmentIds vacío', async () => {
    render(<EditRequirementForm requirement={mockRequirement} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ attachmentIds: [] }) }),
        expect.anything()
      );
    });
  });

  it('guardar con un adjunto agregado durante la edición envía todos los ids vigentes (viejo + nuevo)', async () => {
    const requirementWithAttachment = {
      ...mockRequirement,
      description: 'Descripción inicial ![attach:5]',
    };
    render(<EditRequirementForm requirement={requirementWithAttachment} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/^contexto/i), {
      target: { value: 'Descripción inicial ![attach:5] y nuevo [attach:9]' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ attachmentIds: [5, 9] }) }),
        expect.anything()
      );
    });
  });

  it('guardar tras eliminar un adjunto del texto ya no incluye su id en attachmentIds', async () => {
    const requirementWithAttachment = {
      ...mockRequirement,
      description: 'Descripción inicial ![attach:5]',
    };
    render(<EditRequirementForm requirement={requirementWithAttachment} />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByLabelText(/^contexto/i), {
      target: { value: 'Descripción inicial sin el adjunto' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ attachmentIds: [] }) }),
        expect.anything()
      );
    });
  });
});
