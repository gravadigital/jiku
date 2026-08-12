import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RequirementHeader } from './RequirementHeader';
import type { Requirement } from '../../types/requirement.types';

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
    render(<RequirementHeader requirement={baseRequirement} />);

    const title = screen.getByText(baseRequirement.title);
    const stateBadge = document.querySelector('[data-state]')!;
    const volverButton = screen.getByRole('link', { name: 'Volver' });

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
    render(<RequirementHeader requirement={{ ...baseRequirement, state: 'desarrollo' }} />);
    expect(document.querySelector('[data-state]')).toBeInTheDocument();
    expect(document.querySelector('[data-type]')).toBeInTheDocument();
    expect(document.querySelector('[data-priority]')).toBeInTheDocument();
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

  it('muestra el botón Volver con href a /requirements', () => {
    render(<RequirementHeader requirement={baseRequirement} />);
    const backLink = screen.getByRole('link', { name: /volver/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/requirements');
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

  it('TS-8: para type=incidencia, la Pill Estado NO ofrece "En cola" entre las opciones', () => {
    render(
      <RequirementHeader
        requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Desarrollo'));

    expect(screen.queryByRole('option', { name: 'En cola' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(6);
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
