import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequirementHeader } from './RequirementHeader';
import type { Requirement } from '../../types/requirement.types';

// El barrel `@/shared/components/ui` (Badge, Button) arrastra transitivamente CommentEditor ->
// @/features/objectives -> auth. Sin estos mocks, la resolución real de 'next-auth' falla al
// buscar 'next/server' en este entorno de test. Mismo patrón que RequirementList.test.tsx.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null })),
}));
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const scssContent = fs.readFileSync(
  path.resolve(__dirname, './RequirementHeader.module.scss'),
  'utf8'
);

// Extrae el bloque `{ ... }` de un selector contando llaves balanceadas.
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

const baseRequirement: Requirement = {
  id: 128,
  title: 'Error al guardar cambios en perfil',
  description: '## Descripción',
  type: 'funcionalidad',
  priority: 'alta',
  state: 'analisis',
  visibilityLevel: 'public',
  estimatedFinishDate: null,
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

describe('RequirementHeader', () => {
  // S-090: en mobile/tablet, los botones Volver/Editar (flex-shrink: 0) le quitaban espacio
  // horizontal al título en pantallas angostas, cortándolo. Se apila verticalmente por debajo
  // de 1023px, en el orden que ya trae el DOM: título, pills, botones.
  it('S-090: .pageHeader apila verticalmente por debajo de 1023px (mobile/tablet)', () => {
    const pageHeaderBlock = extractBlock(scssContent, /\.pageHeader\s*{/);
    expect(pageHeaderBlock).not.toBe('');
    expect(pageHeaderBlock).toMatch(/@media\s*\(max-width:\s*1023px\)/);

    const stackedBlock = extractBlock(pageHeaderBlock, /@media\s*\(max-width:\s*1023px\)\s*{/);
    expect(stackedBlock).toMatch(/flex-direction:\s*column/);
  });

  it('S-090: el orden del DOM es título, luego pills, luego botones (Volver/Editar)', () => {
    render(<RequirementHeader requirement={baseRequirement} onUpdate={vi.fn()} />);

    const title = screen.getByText(baseRequirement.title);
    // S-057: los tres badges editables (estado/tipo/prioridad) comparten el aria-label
    // "Estado: {label}" — limitación conocida del componente `Badge` del DS, registrada en el
    // changelog de la story. Se identifica el de estado por su label exacto.
    const stateBadge = screen.getByRole('button', { name: 'Estado: Análisis' });
    const volverButton = screen.getByRole('button', { name: 'Volver' });

    // compareDocumentPosition con DOCUMENT_POSITION_FOLLOWING confirma que el segundo
    // argumento aparece DESPUÉS del elemento sobre el que se invoca el método.
    expect(
      title.compareDocumentPosition(stateBadge) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      stateBadge.compareDocumentPosition(volverButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('restaura la Pill Estado junto a Tipo y Prioridad (coexiste con la Card Estado del detalle)', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Estado: Desarrollo' })).toBeInTheDocument();
    expect(screen.getByText('Desarrollo')).toBeInTheDocument();
    expect(screen.getByText('Funcionalidad')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('la Pill Estado se sincroniza cuando el requirement se actualiza externamente (ej. transición desde la Card Estado)', () => {
    const { rerender } = render(
      <RequirementHeader requirement={{ ...baseRequirement, state: 'analisis' }} />
    );

    expect(screen.getByText('Análisis')).toBeInTheDocument();

    rerender(<RequirementHeader requirement={{ ...baseRequirement, state: 'planificacion' }} />);

    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.queryByText('Análisis')).not.toBeInTheDocument();
  });

  it('cambiar Estado desde la pill dispara onUpdate con el payload correcto', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'analisis' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Análisis'));
    fireEvent.click(screen.getByRole('option', { name: 'Planificación' }));

    expect(onUpdate).toHaveBeenCalledWith({ state: 'planificacion' });
  });

  it('transición libre: ninguna opción de Estado está deshabilitada, ni siquiera desde Resuelto/Cancelado (CA-2/CA-3)', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Resuelto'));
    const desarrolloOption = screen.getByRole('option', { name: 'Desarrollo' });
    expect(desarrolloOption).not.toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(desarrolloOption);
    expect(onUpdate).toHaveBeenCalledWith({ state: 'desarrollo' });
  });

  it('no llama a onUpdate al seleccionar el mismo estado ya activo', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'analisis' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Análisis'));
    fireEvent.click(screen.getByRole('option', { name: 'Análisis' }));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('muestra badge de ID con formato #128', () => {
    render(<RequirementHeader requirement={{ ...baseRequirement, id: 128 }} />);
    expect(screen.getByText('#128')).toBeInTheDocument();
  });

  it('muestra badge de tipo "Funcionalidad" cuando type es funcionalidad', () => {
    render(<RequirementHeader requirement={{ ...baseRequirement, type: 'funcionalidad' }} />);
    expect(screen.getByText('Funcionalidad')).toBeInTheDocument();
  });

  it('muestra "Sin tipo" (no "sin_tipo") cuando el requisito tiene ese valor persistido', () => {
    render(<RequirementHeader requirement={{ ...baseRequirement, type: 'sin_tipo' as never }} />);
    expect(screen.getByText('Sin tipo')).toBeInTheDocument();
    expect(screen.queryByText('sin_tipo')).not.toBeInTheDocument();
  });

  it('muestra badge de prioridad "Alta" cuando priority es alta', () => {
    render(<RequirementHeader requirement={{ ...baseRequirement, priority: 'alta' }} />);
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  // S-057: `Volver` migra a `Button variant="secondary-nav"`, que no renderiza un <a> real —
  // navega vía `useRouter().push()` en el click (extensión documentada del propio componente).
  it('el botón Volver navega a /requirements al hacer click', () => {
    render(<RequirementHeader requirement={baseRequirement} />);
    const backButton = screen.getByRole('button', { name: /volver/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(mockPush).toHaveBeenCalledWith('/requirements');
  });

  it('muestra el botón Editar', () => {
    render(<RequirementHeader requirement={baseRequirement} />);
    expect(screen.getByText(/editar/i)).toBeInTheDocument();
  });

  it('muestra el título del requisito', () => {
    render(<RequirementHeader requirement={baseRequirement} />);
    expect(screen.getByText('Error al guardar cambios en perfil')).toBeInTheDocument();
  });

  it('cambiar Tipo dispara onUpdate con el payload correcto (regresión post S-065)', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, type: 'funcionalidad' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Funcionalidad'));
    fireEvent.click(screen.getByRole('option', { name: 'Mejora' }));

    expect(onUpdate).toHaveBeenCalledWith({ type: 'mejora' });
  });

  it('cambiar Prioridad dispara onUpdate con el payload correcto (regresión post S-065)', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, priority: 'alta' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Alta'));
    fireEvent.click(screen.getByRole('option', { name: 'Urgente' }));

    expect(onUpdate).toHaveBeenCalledWith({ priority: 'urgente' });
  });

  it('no llama a onUpdate al seleccionar el mismo tipo ya activo', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, type: 'funcionalidad' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Funcionalidad'));
    fireEvent.click(screen.getByRole('option', { name: 'Funcionalidad' }));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('no llama a onUpdate al seleccionar la misma prioridad ya activa', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, priority: 'alta' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Alta'));
    fireEvent.click(screen.getByRole('option', { name: 'Alta' }));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('TS-1/TS-3: para type=incidencia, la Pill Estado ofrece "En cola" entre las 7 opciones y seleccionarla dispara onUpdate', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, type: 'incidencia', state: 'planificacion' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Planificación'));

    expect(screen.getAllByRole('option')).toHaveLength(7);
    const enColaOption = screen.getByRole('option', { name: 'En cola' });
    expect(enColaOption).toBeInTheDocument();

    fireEvent.click(enColaOption);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ state: 'en_cola' });
  });

  it('TS-10: para otro tipo, la Pill Estado sigue ofreciendo "En cola" (7 opciones)', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, type: 'funcionalidad', state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Desarrollo'));

    expect(screen.getByRole('option', { name: 'En cola' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(7);
  });

  it('TS-4: la Pill Estado no está deshabilitada con el requisito en "resuelto"', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={vi.fn()}
      />
    );

    const stateButton = screen.getByRole('button', { name: 'Estado: Resuelto' });
    expect(stateButton).not.toBeDisabled();

    fireEvent.click(stateButton);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(7);
  });

  it('TS-5: la Pill Estado no está deshabilitada con el requisito en "cancelado"', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'cancelado' }}
        onUpdate={vi.fn()}
      />
    );

    const stateButton = screen.getByRole('button', { name: 'Estado: Cancelado' });
    expect(stateButton).not.toBeDisabled();

    fireEvent.click(stateButton);
    expect(screen.getAllByRole('option')).toHaveLength(7);
  });

  // S-057: `Badge` editable no tiene prop `disabled` (spec, deliberado — ver Architectural
  // Context). El deshabilitado por `isPending` que ofrecía el `PillDropdown` a medida ya no es
  // reproducible con el componente del DS; no está protegido por CA-3 (que sólo exige que el
  // control NUNCA se deshabilite en estado terminal, algo que sigue cumpliéndose). Se deja
  // registrado como gap de UX menor, no bloqueante, en el changelog de la story.
  it('TS-7 (ajustado S-057): el badge de estado no expone estado disabled — Badge editable no lo soporta', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={vi.fn()}
        isPending
      />
    );

    const stateButton = screen.getByRole('button', { name: 'Estado: Resuelto' });
    expect(stateButton).not.toBeDisabled();
  });

  it('TS-8 (ajustado S-057): sin onUpdate (readonly), el estado se muestra como Badge no interactivo', () => {
    render(<RequirementHeader requirement={{ ...baseRequirement, state: 'resuelto' }} />);

    expect(screen.getByText('Resuelto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Estado:/ })).not.toBeInTheDocument();
  });

  it('TS-16: incidencia ya en "En cola" sigue mostrando ese valor en la Pill Estado', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, type: 'incidencia', state: 'en_cola' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('En cola')).toBeInTheDocument();
  });

  it('S-087 (Task 2): la Pill Estado es 100% controlada por el prop requirement, sin estado optimista propio — tras un intento de transición fallido (el prop nunca cambia, gracias al rollback de useUpdateRequirement), sigue mostrando el valor original', () => {
    // Antes del fix (S-087), la Pill guardaba `state` en un useState local que se
    // actualizaba de forma optimista en el click, ANTES de que la mutación resolviera.
    // Si la mutación fallaba, el cache de React Query nunca llegaba a reflejar el valor
    // nuevo (queda en el original todo el tiempo, gracias al rollback de la Tarea 1) —
    // por lo que el prop `requirement.state` NUNCA CAMBIABA, y el useEffect de
    // sincronización (que dependía de que el prop cambiara) nunca se disparaba: el
    // estado local quedaba "pegado" al valor optimista incorrecto para siempre.
    // El fix elimina el estado local: la Pill ahora deriva `state` directamente de
    // `requirement.state`, por lo que nunca puede quedar desincronizada del cache.
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'analisis' }}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Análisis'));
    fireEvent.click(screen.getByRole('option', { name: 'Resuelto' }));

    // Sin mutación optimista: la Pill sigue mostrando el valor real (`requirement.state`)
    // hasta que la mutación efectivamente tenga éxito y el prop cambie.
    expect(screen.getByText('Análisis')).toBeInTheDocument();
    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument();
  });

  it('S-087 (Task 2): tras una transición exitosa (el prop requirement cambia), la Pill Estado refleja el nuevo valor', () => {
    const { rerender } = render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'analisis' }}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Análisis'));
    fireEvent.click(screen.getByRole('option', { name: 'Planificación' }));

    // La mutación tuvo éxito — React Query actualiza el cache, RequirementDetail
    // recibe el nuevo requirement y lo pasa como prop.
    rerender(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'planificacion' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Planificación')).toBeInTheDocument();
    expect(screen.queryByText('Análisis')).not.toBeInTheDocument();
  });
});

// S-057 (Task 1) — TS-1 a TS-4: fijan el comportamiento de S-050/REQ-012 en tests que pasan
// contra el código SIN MIGRAR, antes de tocar la presentación. Tienen que seguir pasando sin
// modificarse una vez migrada la cabecera a `Badge variant="editable"` (Task 4).
describe('S-057: preservación de comportamiento (CA-3) — pill de estado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-1: el control de estado ofrece los siete estados en un requisito en curso', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Desarrollo'));

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(7);
    [
      'Análisis',
      'Planificación',
      'En cola',
      'Desarrollo',
      'Revisión',
      'Resuelto',
      'Cancelado',
    ].forEach((label) => {
      expect(within(listbox).getByRole('option', { name: label })).toBeInTheDocument();
    });
  });

  it('TS-2: el control de estado SIGUE ofreciendo los siete estados en estado terminal, sin quedar deshabilitado', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={vi.fn()}
      />
    );

    const trigger = screen.getByText('Resuelto').closest('button');
    expect(trigger).not.toBeNull();
    expect(trigger).not.toBeDisabled();
    expect(trigger).not.toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(trigger as HTMLButtonElement);

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(7);
  });

  it('TS-3: elegir un estado dispara la misma mutación que hoy, una única vez', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, id: 128, state: 'analisis' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Análisis'));
    fireEvent.click(screen.getByRole('option', { name: 'Revisión' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ state: 'revision' });
  });

  it('TS-4: se puede volver hacia atrás en el flujo, sin mensaje de transición inválida', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, state: 'revision' }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Revisión'));
    fireEvent.click(screen.getByRole('option', { name: 'Análisis' }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({ state: 'analisis' });
    expect(screen.queryByText(/transici[oó]n inv[aá]lida/i)).not.toBeInTheDocument();
  });
});
