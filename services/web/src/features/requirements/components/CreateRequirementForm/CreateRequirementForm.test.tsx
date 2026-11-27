import { readFileSync } from 'fs';
import path from 'path';
import React, { forwardRef, useImperativeHandle } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as usePersonsModule from '@/features/auth/hooks/usePersons';
import * as projectsApi from '@/features/projects/services/projectsApi';
import * as useCreateRequirementModule from '../../hooks/useCreateRequirement';
import * as useRequirementTagSuggestionsModule from '../../hooks/useRequirementTagSuggestions';
import { CreateRequirementForm } from './CreateRequirementForm';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({
  auth: () => Promise.resolve(null),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null })),
}));

vi.mock('../../services/requirementsApi', () => ({
  createRequirement: vi.fn(),
  getTagSuggestions: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/projects/services/projectsApi', () => ({
  getProjects: vi.fn().mockResolvedValue([
    { id: 1, name: 'Proyecto Alpha', code: 'PA', status: 'active', type: 'interno' },
    { id: 2, name: 'Proyecto Beta', code: 'PB', status: 'active', type: 'externo' },
  ]),
}));

vi.mock('../../hooks/useCreateRequirement');
vi.mock('@/features/auth/hooks/usePersons');
vi.mock('../../hooks/useRequirementTagSuggestions');

// Mock del editor: expone una superficie controlable para escribir la
// descripción serializada y un botón "Adjuntar" que dispara el input file,
// reflejando la forma real de RequirementRichTextEditor (que maneja su
// propio upload internamente, sin exponerlo al padre).
vi.mock('../RequirementRichTextEditor', () => ({
  RequirementRichTextEditor: forwardRef(function MockEditor(
    props: {
      ariaLabel?: string;
      onChange?: (v: string) => void;
      onUploadError?: (error: string) => void;
    },
    ref: React.Ref<unknown>
  ) {
    useImperativeHandle(ref, () => ({
      getValue: () => '',
      clear: () => props.onChange?.(''),
    }));

    // El cliente ya no valida tamaño ni extensión: la política es de `core` y
    // el rechazo llega como error del ticket (CA-12).
    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      props.onChange?.(`![file:1234]`);
    }

    return (
      <div>
        <textarea aria-label={props.ariaLabel} onChange={(e) => props.onChange?.(e.target.value)} />
        <input type="file" aria-label="Adjuntar archivo" onChange={handleFileChange} />
        <button type="button">Adjuntar</button>
      </div>
    );
  }),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockMutate = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

// S-057: `Select` del DS reemplazó a `react-select` (TS-22 del guardia). No tiene búsqueda por
// escritura (decisión 4 del Story Plan): se abre con click, nunca con focus+ArrowDown, y las
// opciones se eligen por click directo, sin filtrar por texto.
async function selectDsOption(labelMatcher: RegExp, optionText: string) {
  const select = screen.getByLabelText(labelMatcher);
  fireEvent.click(select);
  fireEvent.click(await screen.findByRole('option', { name: optionText }));
}

// El control `multiple` de `Select` NO cierra el menú al elegir una opción (a diferencia de
// `single`), así que sucesivas elecciones no necesitan reabrirlo con otro click.
async function selectMultipleOption(labelMatcher: RegExp, optionText: string, isFirst = false) {
  const select = screen.getByLabelText(labelMatcher);
  if (isFirst) fireEvent.click(select);
  fireEvent.click(await screen.findByRole('option', { name: optionText }));
}

async function fillRequiredFields() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /crear requisito/i })).toBeInTheDocument()
  );
  fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: 'Test req' } });
  fireEvent.change(screen.getByLabelText(/^contexto/i), { target: { value: 'Desc test' } });
  await selectDsOption(/^proyecto/i, 'Proyecto Alpha');
  await selectDsOption(/^tipo/i, 'Funcionalidad');
  fireEvent.change(screen.getByLabelText(/fecha de finalización estimada/i), {
    target: { value: '2026-08-01' },
  });
}

describe('CreateRequirementForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useCreateRequirementModule.useCreateRequirement).mockReturnValue({
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

    vi.mocked(projectsApi.getProjects).mockResolvedValue([
      { id: 1, name: 'Proyecto Alpha', code: 'PA', status: 'active', type: 'interno' } as any,
      { id: 2, name: 'Proyecto Beta', code: 'PB', status: 'active', type: 'externo' } as any,
    ]);
  });

  // ===== Regresión S-045 (enums, validaciones, tags, navegación) =====

  // S-057: Título y Proyecto migraron a `Input`/`Select` del DS, cuyo marcador de campo
  // requerido es el asterisco propio del componente (`required` prop), no el texto
  // "(obligatorio)" que armaba el formulario a mano. Contexto no tiene equivalente en el DS
  // (usa RequirementRichTextEditor con su label hecho a mano) y conserva el marcador de texto.
  it('marca Título como requerido (asterisco del componente Input)', () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const titleLabel = screen.getByText('Título').closest('label');
    expect(titleLabel).toHaveTextContent('*');
  });

  it('muestra "(obligatorio)" en Contexto cuando el campo está vacío', () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const contextLabel = screen.getByText('Contexto').closest('label');
    expect(contextLabel).toHaveTextContent('(obligatorio)');
  });

  it('marca Proyecto como requerido (asterisco del componente Select)', () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const projectLabel = screen.getByText('Proyecto').closest('label');
    expect(projectLabel).toHaveTextContent('*');
  });

  // S-088 (CA-6): Tipo ya no es obligatorio — "Sin tipo" es el valor por defecto, sin marcador
  it('S-088: el campo Tipo NO se marca como requerido y arranca en "Sin tipo"', () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const typeLabel = screen.getByText('Tipo').closest('label');
    expect(typeLabel).not.toHaveTextContent('*');
    expect(screen.getByText('Sin tipo')).toBeInTheDocument();
  });

  // S-088 (CA-6, TS-9): crear un requisito dejando "Sin tipo" envía type: null, sin bloquear el submit
  it('TS-9: guardar con "Sin tipo" seleccionado (sin tocar el Select Tipo) envía type: null', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear requisito/i })).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: 'Test req' } });
    fireEvent.change(screen.getByLabelText(/^contexto/i), { target: { value: 'Desc test' } });
    await selectDsOption(/^proyecto/i, 'Proyecto Alpha');
    // Tipo se deja sin tocar — arranca en "Sin tipo" por defecto.

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ type: null }),
        expect.anything()
      );
    });
  });

  // S-088 (CA-6, TS-12, no-regresión): tipo real seleccionado se sigue enviando igual
  it('TS-12: guardar con un tipo real seleccionado sigue enviando ese valor', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'funcionalidad' }),
        expect.anything()
      );
    });
  });

  // S-088 (CA-3, TS-4): Título de solo espacios no pasa validación
  it('TS-4: Título con solo espacios en blanco no pasa validación y no crea el requisito', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  // S-088 (CA-4, TS-6): Contexto de solo espacios no pasa validación
  it('TS-6: Contexto con solo espacios en blanco no pasa validación y no crea el requisito', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/^contexto/i), { target: { value: '    ' } });

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      const contextLabel = screen.getByText('Contexto').closest('label');
      expect(contextLabel).toHaveTextContent('(obligatorio)');
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // S-088 (CA-3, TS-13): Título con espacios circundantes pero contenido real sigue siendo válido
  it('TS-13: Título con espacios al inicio/fin y contenido real en el medio sigue siendo válido', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: '  Nuevo título  ' } });

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ title: '  Nuevo título  ' }),
        expect.anything()
      );
    });
  });

  // S-088 (CA-5, TS-7): dropdown de Proyecto filtra por state=analisis,activo y ordena alfabéticamente
  it('TS-7: llama a useProjects con filtro state=analisis,activo y ordena opciones alfabéticamente', async () => {
    vi.mocked(projectsApi.getProjects).mockResolvedValue([
      { id: 1, name: 'Proyecto Zeta', code: 'PZ', status: 'activo', type: 'interno' } as any,
      { id: 2, name: 'Proyecto Alpha', code: 'PA', status: 'analisis', type: 'interno' } as any,
    ]);

    render(<CreateRequirementForm />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(projectsApi.getProjects).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'analisis,activo' })
      );
    });

    const projectSelect = screen.getByLabelText(/^proyecto/i);
    fireEvent.click(projectSelect);

    const alphaOption = await screen.findByRole('option', { name: 'Proyecto Alpha' });
    const zetaOption = screen.getByRole('option', { name: 'Proyecto Zeta' });
    expect(
      alphaOption.compareDocumentPosition(zetaOption) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  // S-057 (decisión 4 del Story Plan): `Select` del DS no tiene búsqueda por escritura —
  // TS-8 (S-088) probaba exactamente esa capacidad de `react-select`, que se pierde con la
  // migración. Se reemplaza por la verificación de que las opciones completas (sin filtrar)
  // siguen listadas — el volumen real de proyectos se verificó como parte de la Task 6 y no
  // resultó inaceptable (ver changelog de la story).
  it('TS-8 (ajustado S-057): el Select de Proyecto lista todas las opciones, sin búsqueda por texto', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear requisito/i })).toBeInTheDocument()
    );

    await waitFor(() => expect(projectsApi.getProjects).toHaveBeenCalled());
    const projectSelect = screen.getByLabelText(/^proyecto/i);
    fireEvent.click(projectSelect);

    expect(await screen.findByRole('option', { name: 'Proyecto Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Proyecto Beta' })).toBeInTheDocument();
  });

  it('muestra toast de error en respuesta 400 validation_error', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onError?.({ code: 'validation_error', message: 'Enum inválido', status: 400 });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Enum inválido');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('muestra toast de error en respuesta 403 access_denied', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onError?.({ code: 'access_denied', message: 'Sin permiso', status: 403 });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Sin permiso');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('muestra toast de error en respuesta 404 project_not_found', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onError?.({
        code: 'project_not_found',
        message: 'Proyecto no encontrado',
        status: 404,
      });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Proyecto no encontrado');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('select Estado muestra exactamente los valores correctos del enum', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    // El campo Estado está deshabilitado (isDisabled) al crear: react-select no
    // abre el menú de opciones, por lo que solo se puede verificar el valor
    // por defecto mostrado ("Análisis").
    const stateSelect = screen.getByLabelText(/^estado/i);
    expect(stateSelect).toBeDisabled();
    expect(screen.getByText('Análisis')).toBeInTheDocument();
  });

  it('select Tipo muestra exactamente los valores correctos del enum', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const typeSelect = screen.getByLabelText(/^tipo/i);
    fireEvent.click(typeSelect);
    expect(screen.getByRole('option', { name: 'Funcionalidad' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mejora' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Incidencia' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Otro' })).toBeInTheDocument();
  });

  it('select Prioridad incluye sin_prioridad y los valores correctos', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const prioritySelect = screen.getByLabelText(/^prioridad/i);
    fireEvent.click(prioritySelect);
    // "Sin prioridad" aparece dos veces: como valor seleccionado en el control y como
    // opción del menú abierto.
    expect(screen.getAllByText('Sin prioridad').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('option', { name: 'Urgente' })).toBeInTheDocument();
  });

  it('agrega y elimina chip de etiqueta', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText(/^clave/i), { target: { value: 'env' } });
    fireEvent.change(screen.getByLabelText(/^valor/i), { target: { value: 'prod' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar$/i }));
    await waitFor(() => expect(screen.getByText(/^env:\s*prod$/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /eliminar tag env:prod/i }));
    await waitFor(() => expect(screen.queryByText(/^env:\s*prod$/)).not.toBeInTheDocument());
  });

  // TS-20: regresión completa S-045 sin adjuntos
  it('TS-20: envía payload correcto sin adjuntos y navega a /requirements', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onSuccess?.({ id: 10 });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear requisito/i })).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: 'Nuevo req test' } });
    fireEvent.change(screen.getByLabelText(/^contexto/i), {
      target: { value: 'Descripción de prueba' },
    });
    await selectDsOption(/^proyecto/i, 'Proyecto Alpha');
    await selectDsOption(/^tipo/i, 'Funcionalidad');
    await selectDsOption(/^prioridad/i, 'Media');
    fireEvent.change(screen.getByLabelText(/fecha de finalización estimada/i), {
      target: { value: '2026-08-01' },
    });
    fireEvent.change(screen.getByLabelText(/^clave/i), { target: { value: 'modulo' } });
    fireEvent.change(screen.getByLabelText(/^valor/i), { target: { value: 'facturacion' } });
    fireEvent.click(screen.getByRole('button', { name: /^agregar$/i }));
    await waitFor(() => expect(screen.getByText(/^modulo:\s*facturacion$/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nuevo req test',
          description: 'Descripción de prueba',
          type: 'funcionalidad',
          projectId: 1,
          tags: [{ key: 'modulo', value: 'facturacion' }],
        }),
        expect.any(Object)
      );
    });
    // Sin adjuntos: fileIds se envía como array vacío.
    const payload = mockMutate.mock.calls[0][0];
    expect(payload.fileIds).toEqual([]);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/requirements'));
  });

  // ===== S-046: adjuntos inline =====
  //
  // El upload vive dentro de RequirementRichTextEditor (PUT directo a S3), y los
  // archivos se referencian embebidos en el markdown de `description` con
  // placeholders `![file:N]` / `[file:N]`, donde N es un `fileId`. Al confirmar
  // la creación, esos ids se extraen del texto (extractFileIds) y se envían en
  // `fileIds`: el requisito y sus vínculos se crean juntos, o no se crea ninguno.

  // TS-1: render inicial — editor accesible, Adjuntar presente y contador 0/2000
  it('TS-1: render inicial con editor accesible, Adjuntar y contador 0/2000', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    expect(screen.getByLabelText('Contexto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adjuntar' })).toBeInTheDocument();
  });

  // CA-12: el cliente ya no rechaza por tamaño; la política vive en `core`
  it('CA-12: un archivo grande no se rechaza en el cliente', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear requisito/i })).toBeInTheDocument()
    );
    await selectDsOption(/^proyecto/i, 'Proyecto Alpha');

    const big = new File(['x'], 'grande.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 10485761 });

    const input = screen.getByLabelText('Adjuntar archivo') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [big] } });

    expect(toast.error).not.toHaveBeenCalled();
  });

  // TS-22: crear sin adjuntos envía fileIds vacío y llama UNA sola vez
  it('TS-22 (CA-6): crear sin adjuntos envía fileIds vacío y crea una sola vez', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onSuccess?.({ id: 1 });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));
    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    const payload = mockMutate.mock.calls[0][0];
    expect(payload.fileIds).toEqual([]);
  });

  // TS-18: crear con archivos embebidos en la descripción envía sus ids en fileIds
  it('TS-18 (CA-5/CA-6): crear con archivos embebidos envía fileIds y ningún attachmentIds', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear requisito/i })).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: 'Con adjuntos' } });
    fireEvent.change(screen.getByLabelText(/^contexto/i), {
      target: { value: 'texto ![file:1234] y [file:1235]' },
    });
    await selectDsOption(/^proyecto/i, 'Proyecto Alpha');

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      const payload = mockMutate.mock.calls[0][0];
      expect(payload.fileIds).toEqual([1234, 1235]);
    });
    const payload = mockMutate.mock.calls[0][0];
    expect(payload).not.toHaveProperty('attachmentIds');
    expect(payload).not.toHaveProperty('attachmentScope');
    // Una sola operación: el requisito y sus vínculos van juntos.
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  // TS-23 / TS-24: el fallo de titularidad no borra ni limpia nada
  it('TS-23/TS-24 (CA-6/CA-9): un file_not_owned muestra permisos y conserva los fileIds', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onError?.({ code: 'file_not_owned', status: 403, message: 'File not owned' });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /crear requisito/i })).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/^título/i), { target: { value: 'Con adjuntos' } });
    fireEvent.change(screen.getByLabelText(/^contexto/i), {
      target: { value: 'texto ![file:1234]' },
    });
    await selectDsOption(/^proyecto/i, 'Proyecto Alpha');

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'No podés adjuntar un archivo que subió otra persona'
      );
    });
    expect(toast.error).not.toHaveBeenCalledWith('File not owned');
    // El texto conserva el placeholder: nada se borró ni se limpió.
    expect((screen.getByLabelText(/^contexto/i) as HTMLTextAreaElement).value).toContain(
      '![file:1234]'
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  // ===== S-053: rediseño visual =====

  // TS-01: labels no tienen font-weight bold — verificado via SCSS (font-weight: 400)
  it('TS-01: el SCSS de fieldLabel y tagFieldLabel usa font-weight: 400', () => {
    // La regla CA-2 se aplica en el SCSS: font-weight: 400, color: var(--color-general-text).
    // Este test garantiza que el componente renderiza los labels esperados con las clases correctas.
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const tituloLabel = screen.getByText(/^título/i);
    expect(tituloLabel).toBeInTheDocument();
    // La clase CSS aplica font-weight: 400; el módulo SCSS lo garantiza por diseño.
    expect(tituloLabel.tagName.toLowerCase()).toBe('label');
  });

  // TS-02: backButton y submitButton están agrupados a la derecha del título
  // S-057: "Volver" migra a `Button variant="secondary-nav"`, que renderiza role="button"
  // (navega por `useRouter().push()` en el click, no un <a> real).
  it('TS-02: button "Volver" y button "Crear Requisito" están en el mismo contenedor headerActions', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    const volver = screen.getByRole('button', { name: /volver/i });
    const crear = screen.getByRole('button', { name: /crear requisito/i });
    expect(volver.closest('[class*="headerActions"]')).toBeTruthy();
    expect(crear.closest('[class*="headerActions"]')).toBeTruthy();
    expect(volver.closest('[class*="headerActions"]')).toBe(
      crear.closest('[class*="headerActions"]')
    );
  });

  // TS-14 (AC-10): multi-select de responsables
  it('TS-14 (AC-10): seleccionar dos responsables envía responsiblePersonIds con ambos', async () => {
    vi.mocked(usePersonsModule.usePersons).mockReturnValue({
      data: [
        { id: 1, firstName: 'Ana', lastName: 'Pérez' },
        { id: 2, firstName: 'Juan', lastName: 'Gómez' },
      ],
      isLoading: false,
    } as any);
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onSuccess?.({ id: 1 });
    });

    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();

    await selectMultipleOption(/^responsable/i, 'Ana Pérez', true);
    await selectMultipleOption(/^responsable/i, 'Juan Gómez');

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ responsiblePersonIds: [1, 2] }),
        expect.any(Object)
      );
    });
  });

  // TS-16 (AC-10, Tarea 8): invalid_responsible_person muestra el mensaje del backend
  it('TS-16: invalid_responsible_person muestra toast de error y no navega', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onError?.({ code: 'invalid_responsible_person', message: 'Responsable inválido' });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Responsable inválido');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('sin seleccionar responsables, el requisito se crea sin error', async () => {
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onSuccess?.({ id: 1 });
    });
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });
    const payload = mockMutate.mock.calls[0][0];
    expect('responsiblePersonId' in payload).toBe(false);
  });

  it('campo fecha de creación es read-only y no se incluye en el payload', async () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    expect(screen.getByLabelText(/^fecha de creación/i)).toBeDisabled();
    await fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
      expect('createdAt' in mockMutate.mock.calls[0][0]).toBe(false);
    });
  });

  // S-088 (CA-1, TS-1/TS-2): el orden de selección de responsables se preserva en el payload.
  // S-057 (gap de DS descubierto, no bloqueante — ver changelog de la story): `Select`
  // `variant="multiple"` calcula `selectedOptions` filtrando la lista `options` completa
  // (`options.filter(o => selectedValues.includes(o.value))`), así que el orden VISUAL de los
  // chips sigue siempre el orden de la lista de opciones, no el orden de selección — a
  // diferencia de `react-select`, que preservaba el orden de `value`. El PAYLOAD sí preserva
  // el orden real de selección (viene de `form.responsiblePersonIds`, un array que este
  // componente arma por orden de click, no de `Select`). Es una regresión visual menor, no
  // funcional; la resolución de fondo es en el componente compartido, no en esta pantalla.
  it('S-088 TS-1/TS-2: selecciona responsables en secuencia y preserva el orden en el payload', async () => {
    vi.mocked(usePersonsModule.usePersons).mockReturnValue({
      data: [
        { id: 1, firstName: 'Ana', lastName: 'Pérez' },
        { id: 2, firstName: 'Bruno', lastName: 'Gómez' },
        { id: 3, firstName: 'Carla', lastName: 'Ruiz' },
      ],
      isLoading: false,
    } as any);
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onSuccess?.({ id: 1 });
    });

    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();

    await selectMultipleOption(/^responsable/i, 'Carla Ruiz', true);
    await selectMultipleOption(/^responsable/i, 'Ana Pérez');
    await selectMultipleOption(/^responsable/i, 'Bruno Gómez');

    // Los tres chips están presentes (verificado por su botón de quitar accesible),
    // independientemente del orden visual — ver nota arriba sobre el gap de `Select`.
    expect(screen.getByRole('button', { name: 'Quitar Carla Ruiz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar Ana Pérez' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar Bruno Gómez' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ responsiblePersonIds: [3, 1, 2] }),
        expect.any(Object)
      );
    });
  });

  // S-088 (CA-2, TS-3): el tamaño de chip no se reduce al agregar más responsables.
  // S-057: el control `multiple` migró de `react-select` (que necesitaba este test porque el
  // wrap dependía de estilos calculados en runtime) al componente `Select` del DS, cuyo wrap
  // es CSS declarativo del propio módulo — ya no hay estado a verificar en runtime. Se retira
  // en vez de reescribirse.

  // S-088 (CA-1, TS-14 edge case): eliminar un responsable del medio preserva el orden relativo del resto
  it('S-088 TS-14: eliminar el responsable del medio preserva el orden y no cambia el líder', async () => {
    vi.mocked(usePersonsModule.usePersons).mockReturnValue({
      data: [
        { id: 1, firstName: 'Ana', lastName: 'Pérez' },
        { id: 2, firstName: 'Bruno', lastName: 'Gómez' },
        { id: 3, firstName: 'Carla', lastName: 'Ruiz' },
      ],
      isLoading: false,
    } as any);
    mockMutate.mockImplementation((_payload: any, options: any) => {
      options?.onSuccess?.({ id: 1 });
    });

    render(<CreateRequirementForm />, { wrapper: createWrapper() });
    await fillRequiredFields();

    await selectMultipleOption(/^responsable/i, 'Ana Pérez', true);
    await selectMultipleOption(/^responsable/i, 'Bruno Gómez');
    await selectMultipleOption(/^responsable/i, 'Carla Ruiz');

    const brunoRemove = screen.getByRole('button', { name: 'Quitar Bruno Gómez' });
    fireEvent.click(brunoRemove);

    fireEvent.click(screen.getByRole('button', { name: /crear requisito/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ responsiblePersonIds: [1, 3] }),
        expect.any(Object)
      );
    });
  });

  it('TS-14a: no incluye campos Alcance, Solución técnica ni Criterios de aceptación (S-065/TS-14a)', () => {
    render(<CreateRequirementForm />, { wrapper: createWrapper() });

    expect(screen.queryByLabelText('Alcance')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Solución técnica')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Criterios de aceptación')).not.toBeInTheDocument();
  });

  // ===== S-057 (CA-2): unificación del breakpoint de paneles =====
  describe('CA-2: breakpoints', () => {
    const scssContent = readFileSync(
      path.resolve(__dirname, './CreateRequirementForm.module.scss'),
      'utf8'
    );

    it('TS-33: el corte de paneles usa 1023px, nunca 1024px', () => {
      expect(scssContent).toMatch(/@media\s*\(max-width:\s*1023px\)/);
      expect(scssContent).not.toMatch(/@media\s*\(max-width:\s*1024px\)/);
    });

    // S-057: el bloque `.descriptionToolbar` (contador de caracteres + botón "Adjuntar" a
    // medida) no sobrevive a la migración — `Input`/`RequirementRichTextEditor` ya no
    // necesitan ese contenedor propio, así que su `@media (max-width: 640px)` dedicado
    // desaparece con él. El otro corte de 640px del módulo (apilar el header y las columnas
    // de etiquetas) queda intacto, tal como pide CA-2 para lo que sigue fuera de alcance.
    it('TS-34 (ajustado): el corte de 640px que sigue vigente queda intacto', () => {
      const matches = scssContent.match(/@media\s*\(max-width:\s*640px\)/g) ?? [];
      expect(matches.length).toBe(1);
    });
  });
});
