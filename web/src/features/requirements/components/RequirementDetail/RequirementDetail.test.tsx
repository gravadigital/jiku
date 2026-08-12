import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useUpdateRequirementModule from '../../hooks/useUpdateRequirement';
import { RequirementDetail } from './RequirementDetail';
import type { Requirement } from '../../types/requirement.types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../../services/requirementsApi', () => ({
  updateRequirement: vi.fn(),
}));

vi.mock('../../hooks/useUpdateRequirement');

vi.mock('@/features/attachments/components/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div data-testid="markdown-viewer">{content}</div>
  ),
}));

vi.mock('../RequirementActivityFeed', () => ({
  RequirementActivityFeed: () => <div data-testid="activity-feed" />,
}));

vi.mock('../RequirementActivityForm', () => ({
  RequirementActivityForm: () => <div data-testid="activity-form" />,
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const baseRequirement: Requirement = {
  id: 5,
  title: 'Req test',
  description: '## Descripción',
  type: 'funcionalidad',
  priority: 'alta',
  state: 'analisis',
  visibilityLevel: 'public',
  estimatedFinishDate: '2026-06-30',
  projectId: 1,
  project: { id: 1, name: 'PRJ-1' },
  responsiblePeople: [],
  createdBy: 'ivan@grava.io',
  creator: { id: 'u1', name: 'Iván López', email: 'ivan@grava.io' },
  tags: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  activity: [],
  resolutionConclusion: null,
  scope: null,
  technicalSolution: null,
  acceptanceCriteria: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const scssContent = fs.readFileSync(
  path.resolve(__dirname, './RequirementDetail.module.scss'),
  'utf8'
);

// Extrae el bloque `{ ... }` de un selector contando llaves balanceadas, en vez de un regex
// `[^}]*` que corta en el primer `}` de un selector/mixin anidado.
function extractBlock(source: string, selectorPattern: RegExp): string {
  const match = source.match(selectorPattern);
  if (!match || match.index === undefined) return '';
  const openBraceIndex = source.indexOf('{', match.index);
  if (openBraceIndex === -1) return '';
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex, i + 1);
    }
  }
  return '';
}

const mockUpdateMutate = vi.fn();

describe('RequirementDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateRequirementModule.useUpdateRequirement).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    } as any);
  });

  it('TS-5: SCSS usa grid-template-columns: 1fr 420px', () => {
    expect(scssContent).toMatch(/grid-template-columns:\s*1fr\s*420px/);
  });

  // S-090 (CA-1, TS-1, ajustado): mobile Y tablet apilan — pedido explícito del usuario de que
  // tablet se comporte igual que mobile en esta pantalla (a diferencia de ObjectiveDetails/
  // ProjectDetails, donde tablet mantiene el layout de 2 columnas)
  it('S-090 TS-1: .container apila a 1 columna hasta 1023px (mobile + tablet unificados)', () => {
    const containerBlock = extractBlock(scssContent, /\.container\s*{/);
    expect(containerBlock).not.toBe('');
    expect(containerBlock).toMatch(/@media\s*\(max-width:\s*1023px\)/);
    expect(containerBlock).not.toMatch(/@media\s*\(max-width:\s*768px\)/);
    expect(containerBlock).not.toMatch(/@include\s+mobile/);

    const stackedBlock = extractBlock(containerBlock, /@media\s*\(max-width:\s*1023px\)\s*{/);
    expect(stackedBlock).toMatch(/grid-template-columns:\s*1fr\s*;/);
  });

  // S-090 (CA-3, TS-2): desktop (≥1024px) mantiene el grid de 2 columnas sin cambios
  it('S-090 TS-2: .container fuera del breakpoint apilado mantiene grid-template-columns: 1fr 420px (desktop)', () => {
    expect(scssContent).toMatch(/grid-template-columns:\s*1fr\s*420px/);
  });

  // S-090 (CA-1, TS-3, ajustado): tablet (768-1023px) apila igual que mobile — verificado vía
  // render con matchMedia simulando ese rango, ya que el breakpoint unificado (max-width: 1023px)
  // no puede distinguirse de mobile solo leyendo el SCSS estático
  it('S-090 TS-3: en el rango tablet (768-1023px), .container queda dentro del breakpoint apilado', () => {
    const containerBlock = extractBlock(scssContent, /\.container\s*{/);
    // El breakpoint que apila (max-width: 1023px) cubre TODO el rango tablet (768-1023px) —
    // no existe ningún @media con min-width que reintroduzca el grid de 2 columnas dentro
    // de ese rango (o de cualquier otro): .container no debe tener ninguna regla min-width.
    expect(containerBlock).not.toMatch(/@media\s*\(min-width/);
  });

  // S-090 (CA-3, TS-4, ampliado): desktop grande (≥1440px) no tiene ajuste propio que rompa el layout
  it('S-090 TS-4: no existe ninguna regla @include large-desktop que altere el layout de .container', () => {
    const containerBlock = extractBlock(scssContent, /\.container\s*{/);
    expect(containerBlock).not.toMatch(/@include\s+large-desktop/);
  });

  // S-090 (CA-2, TS-5): ningún bloque se oculta — los 8 bloques principales están presentes en el DOM
  it('S-090 TS-5: los 8 bloques principales del detalle están presentes en el DOM', () => {
    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          responsiblePeople: [{ id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true }],
          tags: [{ key: 'env', value: 'prod' }],
          linkedObjectives: [],
        }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Req test')).toBeInTheDocument(); // Header (título del requisito)
    expect(screen.getByText('Contexto')).toBeInTheDocument();
    expect(screen.getByText(/^Estado/)).toBeInTheDocument(); // Card Estado ("Estado - {label}")
    expect(screen.getByText('Tareas')).toBeInTheDocument();
    expect(screen.getByText('Actividad')).toBeInTheDocument();
    expect(screen.getByText('Información General')).toBeInTheDocument();
    expect(screen.getByText('Etiquetas')).toBeInTheDocument();
    expect(screen.getByText('Resolución')).toBeInTheDocument();
  });

  // S-090 (CA-3, TS-6, no-regresión): el mixin mobile no se tocó en los componentes de referencia
  it('S-090 TS-6 (no-regresión): ObjectiveDetails/ProjectDetails siguen usando @include mobile sin cambios', () => {
    const objectiveDetailsScss = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../objectives/components/ObjectiveDetails/ObjectiveDetails.module.scss'
      ),
      'utf8'
    );
    const projectDetailsScss = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../projects/components/ProjectDetails/ProjectDetails.module.scss'
      ),
      'utf8'
    );

    expect(objectiveDetailsScss).toMatch(/@include\s+mobile/);
    expect(projectDetailsScss).toMatch(/@include\s+mobile/);
  });

  it('TS-6: card "Contexto" renderiza con MarkdownViewer y texto de descripción', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, description: '## Hola' }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Contexto')).toBeInTheDocument();
    const markdownViewer = screen.getByTestId('markdown-viewer');
    expect(markdownViewer).toBeInTheDocument();
    expect(markdownViewer).toHaveTextContent('## Hola');
  });

  it('TS-7 / TS-20 (S-067): card "Tareas" está presente en el DOM', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives: [] }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Tareas')).toBeInTheDocument();
  });

  // TS-8/TS-9/TS-10 (AC-6/AC-7): card de Objetivos migrada a linkedObjectives
  describe('Card Tareas — linkedObjectives (AC-6/AC-7)', () => {
    const linkedObjectives = [
      {
        id: 1,
        title: 'Obj A',
        state: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
        estimatedFinishDate: '2026-02-01T00:00:00Z',
        persons: [{ id: 1, firstName: 'Ana', lastName: 'Pérez' }],
      },
      {
        id: 2,
        title: 'Obj B',
        state: 'activo',
        createdAt: '2026-01-05T00:00:00Z',
        estimatedFinishDate: null,
        persons: [
          { id: 1, firstName: 'Ana', lastName: 'Pérez' },
          { id: 2, firstName: 'Juan', lastName: 'Gómez' },
        ],
      },
    ] as any;

    it('la tab "Activo" está seleccionada por defecto al entrar al detalle', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      const activeTab = screen.getByText('Activo').closest('button');
      expect(activeTab?.className).toMatch(/tabActive/);
    });

    it('TS-8: muestra los objetivos vinculados con sus columnas, sin fetch adicional', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Obj A')).toBeInTheDocument();
      expect(screen.getByText('Obj B')).toBeInTheDocument();
    });

    it('TS-9 / TS-20 (S-067): linkedObjectives vacío muestra "Sin tareas en esta etapa"', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives: [] }} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Sin tareas en esta etapa')).toBeInTheDocument();
    });

    it('TS-10: la fila de un objetivo es clickeable y abre el objetivo en una nueva pestaña', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByText('Obj A'));

      expect(openSpy).toHaveBeenCalledWith('/objectives/1', '_blank');
      openSpy.mockRestore();
    });

    it('columna Responsable usa formato "Nombre +N" cuando hay más de un responsable', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Ana Pérez +1')).toBeInTheDocument();
    });

    it('incluye selector de tamaño de página con opciones 5 y 10', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      const select = screen.getByRole('combobox');
      expect(within(select).getByRole('option', { name: '5 por página' })).toBeInTheDocument();
      expect(within(select).getByRole('option', { name: '10 por página' })).toBeInTheDocument();
    });

    describe('Paginado unificado con el de detalle de proyecto', () => {
      const manyObjectives = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        title: `Obj ${i + 1}`,
        state: 'activo',
        createdAt: '2026-01-01T00:00:00Z',
        estimatedFinishDate: null,
        persons: [],
      })) as any;

      it('con una sola página, los botones ‹/› están presentes pero deshabilitados', () => {
        render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
          wrapper: createWrapper(),
        });

        expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
        expect(screen.getByText('‹')).toBeDisabled();
        expect(screen.getByText('›')).toBeDisabled();
      });

      it('con más páginas de las visibles, muestra ellipsis y la última página', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: manyObjectives }}
          />,
          { wrapper: createWrapper() }
        );

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: '5' } });

        expect(screen.getByText('…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
      });

      it('el botón de la página activa tiene aria-current="page"', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: manyObjectives }}
          />,
          { wrapper: createWrapper() }
        );

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: '5' } });

        expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
      });

      it('click en "›" avanza a la página siguiente', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: manyObjectives }}
          />,
          { wrapper: createWrapper() }
        );

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: '5' } });
        fireEvent.click(screen.getByText('›'));

        expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
      });
    });
  });

  it('TS-8: card "Actividad" está presente en el DOM', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, activity: [] }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Actividad')).toBeInTheDocument();
  });

  it('TS-9: SCSS usa grid-template-columns: 1fr 1fr en la grilla de información general', () => {
    expect(scssContent).toMatch(/grid-template-columns:\s*1fr\s*1fr/);
  });

  it('card "Información General" está presente en el DOM', () => {
    render(<RequirementDetail requirement={baseRequirement} />, { wrapper: createWrapper() });

    expect(screen.getByText('Información General')).toBeInTheDocument();
  });

  it('"Fecha estimada" ya no se muestra en Información General — ahora vive en Resolución como "Cierre estimado"', () => {
    render(<RequirementDetail requirement={baseRequirement} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Fecha estimada')).not.toBeInTheDocument();
  });

  it('la Card Resolución antigua (component separado con testid resolution-section) ya no se renderiza', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, type: 'incidencia' }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByTestId('resolution-section')).not.toBeInTheDocument();
  });

  it('la nueva Card Resolución se renderiza en el detalle con sus botones de acción', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, state: 'revision' }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Resolución')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^resolver$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();
  });

  it('para incidencia en estado Resuelto, la Card Resolución muestra Tipo de resolución, Conclusión interna y Nota para cliente', () => {
    render(
      <RequirementDetail
        requirement={{ ...baseRequirement, type: 'incidencia', state: 'resuelto' }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByLabelText('Tipo de resolución')).toBeInTheDocument();
    expect(screen.getByLabelText('Conclusión interna')).toBeInTheDocument();
    expect(screen.getByLabelText('Nota para cliente')).toBeInTheDocument();
  });

  it('para funcionalidad/mejora/otro en estado Resuelto, la Card Resolución no muestra campos de resolución', () => {
    render(
      <RequirementDetail
        requirement={{ ...baseRequirement, type: 'funcionalidad', state: 'resuelto' }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByLabelText('Tipo de resolución')).not.toBeInTheDocument();
  });

  it('TS-15: rechazo defensivo de la API (resolution_required) muestra toast y no cambia el estado', () => {
    mockUpdateMutate.mockImplementation((_vars: any, options: any) => {
      options?.onError?.({ message: 'Cargá una conclusión antes de resolver esta incidencia' });
    });

    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          type: 'incidencia',
          state: 'desarrollo',
          resolutionType: 'error_interno',
        }}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ state: 'resuelto' }) }),
      expect.objectContaining({ onError: expect.any(Function) })
    );
    expect(toast.error).toHaveBeenCalledWith(
      'Cargá una conclusión antes de resolver esta incidencia'
    );
  });

  // S-089 (CA-1, TS-1): líder + N responsables adicionales — "Responsable(s)" en formato "Nombre +N" con tooltip
  it('S-089 TS-1: líder + N responsables adicionales — "Responsable(s)" en formato "Nombre +N" con tooltip', () => {
    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          responsiblePeople: [
            { id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
            { id: 2, firstName: 'Bruno', lastName: 'Gómez', isLeader: null },
            { id: 3, firstName: 'Carla', lastName: 'Ruiz', isLeader: null },
          ],
        }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Responsable (líder)')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Responsable(s)', { selector: 'dt' })).toBeInTheDocument();
    const responsiblesSpan = screen.getByText('Bruno Gómez +1');
    expect(responsiblesSpan).toHaveAttribute('title', 'Bruno Gómez, Carla Ruiz');
  });

  // S-089 (CA-2, TS-2): solo líder, sin responsables adicionales — sin fila "Responsable(s)" vacía
  it('S-089 TS-2: solo líder sin adicionales — no muestra fila "Responsable(s)" vacía', () => {
    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          responsiblePeople: [{ id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true }],
        }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Responsable (líder)')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('Responsable(s)', { selector: 'dt' })).not.toBeInTheDocument();
  });

  // S-089 (CA-3, TS-3): sin responsables asignados — ninguna fila (ni el placeholder anterior)
  it('S-089 TS-3: responsiblePeople vacío — no renderiza ninguna fila de responsables', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, responsiblePeople: [] }} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByText('Responsable (líder)')).not.toBeInTheDocument();
    expect(screen.queryByText('Responsable(s)', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sin responsables')).not.toBeInTheDocument();
  });

  // S-089 (CA-1, TS-4, edge case): sin líder marcado (todos null) — se agrupan todos en "Responsable(s)"
  it('S-089 TS-4: sin líder marcado (isLeader todos null) — agrupa todos en "Responsable(s)"', () => {
    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          responsiblePeople: [
            { id: 1, firstName: 'Bruno', lastName: 'Gómez', isLeader: null },
            { id: 2, firstName: 'Carla', lastName: 'Ruiz', isLeader: null },
          ],
        }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText('Responsable (líder)')).not.toBeInTheDocument();
    expect(screen.getByText('Responsable(s)', { selector: 'dt' })).toBeInTheDocument();
    const responsiblesSpan = screen.getByText('Bruno Gómez +1');
    expect(responsiblesSpan).toHaveAttribute('title', 'Bruno Gómez, Carla Ruiz');
  });

  // S-089 (CA-1, TS-5, edge case): el orden respeta el orden del array (el primero mostrado, no alfabético)
  it('S-089 TS-5: "Responsable(s)" respeta el orden del array recibido, sin ordenar alfabéticamente', () => {
    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          responsiblePeople: [
            { id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
            { id: 2, firstName: 'Zoe', lastName: 'Alvarez', isLeader: null },
            { id: 3, firstName: 'Bruno', lastName: 'Gómez', isLeader: null },
          ],
        }}
      />,
      { wrapper: createWrapper() }
    );

    const responsiblesSpan = screen.getByText('Zoe Alvarez +1');
    expect(responsiblesSpan).toHaveAttribute('title', 'Zoe Alvarez, Bruno Gómez');
  });

  // S-089 (edge case adicional): un único responsable no-líder no muestra "+N" ni tooltip
  it('S-089: un único responsable no-líder muestra solo el nombre, sin "+N" ni tooltip', () => {
    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          responsiblePeople: [
            { id: 1, firstName: 'Ana', lastName: 'Pérez', isLeader: true },
            { id: 2, firstName: 'Bruno', lastName: 'Gómez', isLeader: null },
          ],
        }}
      />,
      { wrapper: createWrapper() }
    );

    const responsibleText = screen.getByText('Bruno Gómez', { selector: 'dd' });
    expect(responsibleText).not.toHaveAttribute('title');
  });

  // AC-8 / TS-11: botón "+" de Objetivos navega al form de creación con requirementId y projectId
  it('TS-11 (AC-8): click en el botón "+" navega a /objectives/new con requirementId y projectId', () => {
    render(<RequirementDetail requirement={{ ...baseRequirement, id: 12, projectId: 5 }} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nueva tarea' }));

    expect(mockPush).toHaveBeenCalledWith('/objectives/new?requirementId=12&projectId=5');
  });

  // AC-8 / TS-11: creador del requisito visible por nombre, no por id/email
  it('TS-11 (AC-8): fila "Creado por" muestra el nombre del creador, no createdBy', () => {
    render(
      <RequirementDetail
        requirement={{
          ...baseRequirement,
          createdBy: 'u1',
          creator: { id: 'u1', name: 'Ana Pérez', email: 'ana@grava.io' },
        }}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.queryByText('u1')).not.toBeInTheDocument();
  });

  describe('Integración RequirementStatusCard (S-065)', () => {
    it('renderiza la Card Estado entre Contexto y Tareas, en la columna izquierda', () => {
      render(<RequirementDetail requirement={baseRequirement} />, { wrapper: createWrapper() });

      const contexto = screen.getByText('Contexto');
      const estado = screen.getByText(/^Estado/);
      const objetivos = screen.getByText('Tareas');

      // DOCUMENT_POSITION_FOLLOWING (4): el nodo referencia sigue al nodo comparado en el DOM
      expect(
        contexto.compareDocumentPosition(estado) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        estado.compareDocumentPosition(objetivos) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('no renderiza la Card Información incompleta — removida a pedido explícito (2026-07-08), CA-8/CA-9 quedan fuera de alcance', () => {
      render(
        <RequirementDetail
          requirement={{
            ...baseRequirement,
            scope: null,
            technicalSolution: 'x',
            acceptanceCriteria: 'y',
          }}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText('Información incompleta')).not.toBeInTheDocument();
    });

    it('confirmar con el botón de transición al siguiente paso dispara la misma mutation centralizada', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, state: 'revision' }} />, {
        wrapper: createWrapper(),
      });

      // Sin navegar: viendo el propio estado actual, el botón ofrece el siguiente paso
      // real del flujo (Revisión → Resuelto), siempre habilitado.
      fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));

      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          reqid: baseRequirement.id,
          payload: expect.objectContaining({ state: 'resuelto' }),
        }),
        expect.objectContaining({ onError: expect.any(Function) })
      );
    });

    it('TS-16: error de sistema al transicionar dispara toast.error con el mensaje fallback (S-065/TS-16)', () => {
      mockUpdateMutate.mockImplementation((_vars: any, options: any) => {
        options?.onError?.({ message: 'Error al actualizar el requisito' });
      });

      render(<RequirementDetail requirement={{ ...baseRequirement, state: 'revision' }} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByRole('button', { name: /^resolver$/i }));

      expect(toast.error).toHaveBeenCalledWith('Error al actualizar el requisito');
      // El círculo del stepper y la pill del header siguen en "Revisión": requirement.state
      // no cambió (el padre no actualiza optimísticamente antes de confirmar el servidor).
      const revisionElements = screen.getAllByText('Revisión');
      const activeStep = revisionElements.find((el) => el.closest('[aria-current="step"]'));
      expect(activeStep).toBeDefined();
    });
  });
});
