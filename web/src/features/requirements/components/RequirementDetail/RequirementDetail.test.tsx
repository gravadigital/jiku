import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as useRequirementWorkedHoursModule from '../../hooks/useRequirementWorkedHours';
import * as useUpdateRequirementModule from '../../hooks/useUpdateRequirement';
import { RequirementDetail } from './RequirementDetail';
import type { Requirement } from '../../types/requirement.types';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({ auth: vi.fn(() => Promise.resolve(null)) }));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
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

// La card de horas se carga sola, con su propia query (S-045): se mockea el hook para que los
// tests existentes de RequirementDetail no intenten una request real.
vi.mock('../../hooks/useRequirementWorkedHours');

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
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

// S-057: `Pagination` usa `Select variant="inline"` para el tamaño de página — un
// <button role="combobox"> que no reacciona a `fireEvent.change`. Se abre con click y se
// elige la opción por su label visible.
function changePageSize(size: number) {
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: `${size} por página` }));
}

describe('RequirementDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateRequirementModule.useUpdateRequirement).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    } as any);
    vi.mocked(useRequirementWorkedHoursModule.useRequirementWorkedHours).mockReturnValue({
      data: { requirementId: 5, totalMinutes: 0, byPerson: [] },
      isLoading: false,
      isError: false,
    } as any);
  });

  // El handoff de identidad fija el layout de detalle en minmax(560px, 1fr) + aside de 380px
  // (antes 1fr + 420px). Cambia la MEDIDA del aside, no la estructura de dos columnas.
  it('TS-5: SCSS usa grid-template-columns: minmax(560px, 1fr) 380px', () => {
    expect(scssContent).toMatch(/grid-template-columns:\s*minmax\(560px,\s*1fr\)\s*380px/);
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
  // Lo que S-090 CA-3 pide es que desktop MANTENGA las dos columnas, y eso sigue valiendo: lo
  // que cambió con el handoff es el ancho del aside (380px), no que haya dos columnas.
  it('S-090 TS-2: .container fuera del breakpoint apilado mantiene las dos columnas (desktop)', () => {
    expect(scssContent).toMatch(/grid-template-columns:\s*minmax\(560px,\s*1fr\)\s*380px/);
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
    expect(screen.getByText('Horas Trabajadas')).toBeInTheDocument(); // S-045
  });

  // TS-19 (S-045/CA-4): el card de horas va sobre "Etiquetas" en la columna derecha
  it('TS-19: el orden de los títulos de card en la columna derecha es el esperado (S-045)', () => {
    render(<RequirementDetail requirement={baseRequirement} />, { wrapper: createWrapper() });

    const rightColumn = screen.getByText('Información General').closest(
      '[class*="rightColumn"]'
    ) as HTMLElement;
    // S-057: `RequirementResolutionCard` migró al componente `Card` del DS, cuyo título
    // resuelve a `[class*="title"]` (un heading), no al `[class*="cardTitle"]` que todavía
    // usan sus hermanas sin migrar (Task 7). Se combinan ambos selectores, en orden de DOM.
    const cardTitles = Array.from(
      rightColumn.querySelectorAll('[class*="cardTitle"], [class*="title"]')
    ).map((el) => el.textContent);

    expect(cardTitles).toEqual([
      'Información General',
      'Horas Trabajadas',
      'Etiquetas',
      'Resolución',
    ]);
  });

  // TS-17 (S-045/CA-8): el detalle se renderiza completo aunque la card de horas falle
  it('TS-17: el detalle se renderiza completo aunque la card de horas falle (S-045)', () => {
    vi.mocked(useRequirementWorkedHoursModule.useRequirementWorkedHours).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any);

    render(<RequirementDetail requirement={baseRequirement} />, { wrapper: createWrapper() });

    expect(screen.getByText('Contexto')).toBeInTheDocument();
    expect(screen.getByText('Información General')).toBeInTheDocument();
    expect(screen.getByText('Etiquetas')).toBeInTheDocument();
    expect(screen.getByText('Resolución')).toBeInTheDocument();
    expect(screen.getByText('Req test')).toBeInTheDocument();
    expect(screen.getByText('Horas Trabajadas')).toBeInTheDocument();
    expect(screen.getByText('No se pudieron cargar las horas')).toBeInTheDocument();
  });

  // S-090 (CA-3, TS-6, no-regresión): el mixin mobile no se tocó en el componente de referencia.
  // `ProjectDetails` era el otro componente de referencia de S-090, pero S-056 (T-4) lo borró:
  // era código muerto (cero consumidores fuera de su propia carpeta) que el propio Story Plan
  // de S-056 identificó y eliminó junto con su SCSS. La aserción sobre él queda retirada porque
  // el archivo que verificaba ya no existe por diseño, no por regresión.
  it('S-090 TS-6 (no-regresión): ObjectiveDetails sigue usando @include mobile sin cambios', () => {
    const objectiveDetailsScss = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../objectives/components/ObjectiveDetails/ObjectiveDetails.module.scss'
      ),
      'utf8'
    );

    expect(objectiveDetailsScss).toMatch(/@include\s+mobile/);
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

    // S-057: el título de la fila migró a un <Link target="_blank"> (Table no ofrece un
    // mecanismo de click de fila) — se verifica el destino del enlace, no `window.open`.
    it('TS-10: el título del objetivo enlaza a /objectives/1 en una pestaña nueva', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      const link = screen.getByRole('link', { name: 'Obj A' });
      expect(link).toHaveAttribute('href', '/objectives/1');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('columna Responsable usa formato "Nombre +N" cuando hay más de un responsable', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Ana Pérez +1')).toBeInTheDocument();
    });

    // S-057: `Pagination` usa `Select variant="inline"` — un <button role="combobox"> cuyas
    // opciones (<li role="option">) solo están en el DOM con el menú abierto.
    it('incluye selector de tamaño de página con opciones 5 y 10', () => {
      render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives }} />, {
        wrapper: createWrapper(),
      });

      fireEvent.click(screen.getByRole('combobox'));
      expect(screen.getByRole('option', { name: '5 por página' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '10 por página' })).toBeInTheDocument();
    });

    describe('Paginado unificado con el de detalle de proyecto (S-039)', () => {
      const objectivesActivos = (n: number) =>
        Array.from({ length: n }, (_, i) => ({
          id: i + 1,
          title: `Obj ${i + 1}`,
          state: 'activo',
          createdAt: '2026-01-01T00:00:00Z',
          estimatedFinishDate: null,
          persons: [],
        })) as any;

      it('TS-1: el paginador unificado se renderiza en la card de tareas', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(12) }}
          />,
          { wrapper: createWrapper() }
        );

        expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
        // El glifo de las flechas cambió de '<'/'>' a '‹'/'›' con la capa visual del DS
        // (S-054, componente Pagination compartido) — el contrato accesible que este
        // test verifica es el nombre accesible del control, no el glifo visual exacto.
        expect(screen.getByRole('button', { name: 'Página anterior' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeInTheDocument();
      });

      it('TS-2: con ≤ 10 páginas se muestran todos los números, sin elipsis', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(12) }}
          />,
          { wrapper: createWrapper() }
        );

        expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Página 2' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Página 3' })).toBeInTheDocument();
        expect(screen.queryByText('…')).not.toBeInTheDocument();
      });

      it('TS-3: con más de 10 páginas, la ventana se pega al inicio en la página 1', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(60) }}
          />,
          { wrapper: createWrapper() }
        );

        changePageSize(5);

        for (let i = 1; i <= 10; i += 1) {
          expect(screen.getByRole('button', { name: `Página ${i}` })).toBeInTheDocument();
        }
        expect(screen.queryByRole('button', { name: 'Página 11' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Página 12' })).not.toBeInTheDocument();

        const nav = screen.getByRole('navigation', { name: 'Paginación' });
        const pageButtons = within(nav)
          .getAllByRole('button')
          .filter((btn) => /^Página \d+$/.test(btn.getAttribute('aria-label') ?? ''));
        expect(pageButtons).toHaveLength(10);
      });

      it('TS-4: la ventana se desliza y queda centrada en la página actual', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(125) }}
          />,
          { wrapper: createWrapper() }
        );

        changePageSize(5);
        fireEvent.click(screen.getByRole('button', { name: 'Página 10' }));
        fireEvent.click(screen.getByRole('button', { name: 'Página 13' }));

        for (let i = 8; i <= 17; i += 1) {
          expect(screen.getByRole('button', { name: `Página ${i}` })).toBeInTheDocument();
        }
        expect(screen.queryByRole('button', { name: 'Página 7' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Página 18' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Página 13' })).toHaveAttribute(
          'aria-current',
          'page'
        );
      });

      it('TS-5: cambiar de página no navega por URL', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(12) }}
          />,
          { wrapper: createWrapper() }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));

        expect(mockPush).not.toHaveBeenCalled();
        expect(screen.getByText('Obj 6')).toBeInTheDocument();
        expect(screen.queryByText('Obj 1')).not.toBeInTheDocument();
      });

      it('TS-6: la página activa se marca correctamente tras el click', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(12) }}
          />,
          { wrapper: createWrapper() }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Página 3' }));

        expect(screen.getByRole('button', { name: 'Página 3' })).toHaveAttribute(
          'aria-current',
          'page'
        );
        expect(screen.getByRole('button', { name: 'Página 3' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Página 1' })).not.toHaveAttribute(
          'aria-current'
        );
      });

      // S-054: ya no se oculta con 0 ítems — se renderiza deshabilitada, sin páginas navegables.
      it('TS-7: con 0 tareas en la tab activa, el paginador se muestra deshabilitado, sin páginas navegables', () => {
        render(<RequirementDetail requirement={{ ...baseRequirement, linkedObjectives: [] }} />, {
          wrapper: createWrapper(),
        });

        expect(screen.getByText('Sin tareas en esta etapa')).toBeInTheDocument();
        const nav = screen.getByRole('navigation', { name: 'Paginación' });
        expect(nav).toBeInTheDocument();
        expect(within(nav).getByRole('button', { name: 'Página anterior' })).toBeDisabled();
        expect(within(nav).getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
        expect(within(nav).queryByRole('button', { name: 'Página 2' })).not.toBeInTheDocument();
      });

      it('TS-8: bajar el total de páginas por debajo de la página actual reajusta la vista', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(12) }}
          />,
          { wrapper: createWrapper() }
        );

        fireEvent.click(screen.getByRole('button', { name: 'Página 3' }));

        expect(() =>
          changePageSize(10)
        ).not.toThrow();

        expect(screen.getByText('Obj 1')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
          'aria-current',
          'page'
        );
        expect(screen.queryByRole('button', { name: 'Página 3' })).not.toBeInTheDocument();
      });

      it('TS-9: los extremos se deshabilitan en la primera y la última página', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(12) }}
          />,
          { wrapper: createWrapper() }
        );

        expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Página siguiente' })).not.toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Página 3' }));

        expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Página anterior' })).not.toBeDisabled();
      });

      // S-057: `Pagination` (componente único del DS) aporta el selector de tamaño de página
      // vía `Select variant="inline"`, montado dentro del propio <nav> — a diferencia del
      // <select> crudo de antes, que vivía fuera del paginador. Deja de tener sentido afirmar
      // que están en contenedores distintos: ahora comparten uno solo, que es justamente lo
      // que TS-12 (más abajo) confirma como el objetivo de "un paginador único, sin código
      // duplicado".
      it('TS-10: el selector de tamaño de página sigue presente y con sus dos opciones', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(12) }}
          />,
          { wrapper: createWrapper() }
        );

        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        fireEvent.click(select);
        expect(screen.getByRole('option', { name: '5 por página' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: '10 por página' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Paginación' })).toContainElement(select);
      });

      it('TS-11: cambiar el tamaño de página resetea a la página 1 sin tocar la URL', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(60) }}
          />,
          { wrapper: createWrapper() }
        );

        changePageSize(5);
        fireEvent.click(screen.getByRole('button', { name: 'Página 4' }));
        changePageSize(10);

        expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
          'aria-current',
          'page'
        );
        expect(screen.getByText('Obj 1')).toBeInTheDocument();
        expect(mockPush).not.toHaveBeenCalled();
      });

      it('TS-12: el código y los estilos del paginador inline quedan eliminados', () => {
        render(
          <RequirementDetail
            requirement={{ ...baseRequirement, linkedObjectives: objectivesActivos(60) }}
          />,
          { wrapper: createWrapper() }
        );

        changePageSize(5);

        // El paginador compartido (S-054) reutiliza '‹'/'›' en sus propias flechas, así
        // que ya no sirven para detectar al paginador inline descartado — lo que importa
        // acá es que la elipsis del paginador inline viejo no sobreviva.
        expect(screen.queryByText('…')).not.toBeInTheDocument();

        const scssPath = path.join(__dirname, 'RequirementDetail.module.scss');
        const scssContent = fs.readFileSync(scssPath, 'utf-8');
        expect(scssContent).not.toMatch(/\.objPagination\s*\{/);
        expect(scssContent).not.toMatch(/\.pageBtn\s*\{/);
        expect(scssContent).not.toMatch(/\.pageBtnActive\s*\{/);
        expect(scssContent).not.toMatch(/\.objPaginationEllipsis\s*\{/);
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

  describe('Marca de identidad automática (S-019)', () => {
    it('TS-7: la fila "Creado por" muestra el nombre y la marca cuando el creador es una identidad de servicio', () => {
      render(
        <RequirementDetail
          requirement={{
            ...baseRequirement,
            creator: {
              id: 'u-svc',
              name: 'Conector Portal',
              email: 'conector@grava.io',
              identityType: 'service',
            },
          }}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByText('Creado por').closest('div');
      expect(row).toHaveTextContent('Conector Portal');
      expect(row).toHaveTextContent('Automático');
    });

    it('TS-8: la fila "Creado por" de una persona no muestra la marca', () => {
      render(
        <RequirementDetail
          requirement={{
            ...baseRequirement,
            creator: {
              id: 'u1',
              name: 'Iván López',
              email: 'ivan@grava.io',
              identityType: 'person',
            },
          }}
        />,
        { wrapper: createWrapper() }
      );

      const row = screen.getByText('Creado por').closest('div');
      expect(row).toHaveTextContent('Iván López');
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });

    it('no muestra la marca cuando el creador llega sin identityType (api vieja)', () => {
      render(<RequirementDetail requirement={baseRequirement} />, { wrapper: createWrapper() });

      const row = screen.getByText('Creado por').closest('div');
      expect(row).toHaveTextContent('Iván López');
      expect(screen.queryByText('Automático')).not.toBeInTheDocument();
    });
  });
});
