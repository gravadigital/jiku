import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequirementStatusCard } from './RequirementStatusCard';
import type { Requirement } from '../../types/requirement.types';

// El barrel `@/shared/components/ui` (Accordion, Button, Card, Stepper, que este componente
// consume desde S-057) arrastra transitivamente CommentEditor -> @/features/objectives -> auth.
// Sin estos mocks, la resolución real de 'next-auth' falla al buscar 'next/server' en este
// entorno de test. Mismo patrón que RequirementList.test.tsx / RequirementHeader.test.tsx.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: null })),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/features/attachments/components/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => (
    <div
      data-testid="markdown-viewer"
      dangerouslySetInnerHTML={{ __html: content.replace(/^## (.*)$/m, '<h2>$1</h2>') }}
    />
  ),
}));

// S-087: el campo correspondiente al `state` real arranca desplegado por defecto (CA-2 a
// CA-5) — este helper es idempotente: solo hace click si el acordeón está cerrado, así
// sirve tanto para campos que ya vienen abiertos como para los que hay que expandir.
// El nombre accesible del botón incluye el ícono (✓/!) además del label, por eso se ubica
// el botón a partir del texto exacto del label en vez de matchear el name completo.
// S-057: el stepper migró al componente `Stepper` del DS. Cada paso es un <li> con el glifo
// (✓ / × / número) en un <span aria-hidden="true"> seguido del label visible; el texto
// accesible real vive en un <span> aparte con "{label}, {estado}" (no matchea `getByText(label)`
// a secas, que es exact-match). Este helper localiza el glifo visual de un paso por su label.
function getStepGlyph(label: string): string | null {
  const item = screen.getByText(label).closest('li');
  // El <li> tiene DOS elementos aria-hidden cuando no es el primer paso: el conector
  // (siempre vacío) y el nodo con el glifo — el nodo es siempre el último de los dos.
  const nodes = item?.querySelectorAll('[aria-hidden="true"]');
  const node = nodes && nodes.length > 0 ? nodes[nodes.length - 1] : undefined;
  return node?.textContent ?? null;
}

function openField(label: string) {
  const button = screen.getByText(label).closest('button')!;
  if (button.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(button);
  }
}

// S-057: `Accordion` renderiza el panel de los 4 campos siempre en el DOM (oculto vía el
// atributo `hidden`, nunca desmontado) — a diferencia del `{open && <div>}` de antes, que
// quitaba el contenido del DOM al colapsar. Como consecuencia, el toggle "Editar"/"Vista
// previa" de `MarkdownEditorWithPreview` existe simultáneamente para los 4 campos (abiertos o
// no), y `getByText('Vista previa')` a secas ya no identifica un único botón. Este helper
// escopa la búsqueda al `role="region"` del campo, ubicado a partir del título del acordeón
// (siempre visible, a diferencia del `<textarea>` con `aria-label`, que se desmonta en modo
// Vista previa).
function getFieldRegion(label: string): HTMLElement {
  const headerButton = screen.getByText(label).closest('button') as HTMLElement;
  const panelId = headerButton.getAttribute('aria-controls');
  return document.getElementById(panelId as string) as HTMLElement;
}

const baseRequirement: Requirement = {
  id: 5,
  title: 'Req test',
  description: '',
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

// S-087 (CA-1 a CA-7): el stepper no navega por click (verificado abajo por "los círculos
// del stepper ya no son interactivos" y "click en un círculo... no cambia la descripción
// mostrada"), el panel de campos deriva siempre del `state` real sin navegación (verificado
// por los tests de placeholders/campos por estado), Resuelto/Cancelado muestran los 5 pasos
// completados, y la transición está disponible vía el botón del panel (tests de "Pasar a X").
// Estos criterios ya estaban implementados por trabajo previo a esta story — no se agregan
// tests duplicados, se referencian los existentes como evidencia de cobertura.
describe('RequirementStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra los 5 pasos de trabajo del stepper, con aria-current en el estado real', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'revision' }}
        onUpdate={vi.fn()}
      />
    );

    ['Análisis', 'Planificación', 'En cola', 'Desarrollo', 'Revisión'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    const activeStep = screen.getByText('Revisión').closest('[aria-current="step"]');
    expect(activeStep).not.toBeNull();
  });

  it('no muestra Resuelto ni Cancelado en el stepper (viven en RequirementResolutionCard)', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'analisis' }}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();
  });

  it('el stepper muestra glifos por estado (✓ recorrido, número pendiente)', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    expect(getStepGlyph('Análisis')).toBe('✓');
    expect(getStepGlyph('Revisión')).toBe('5');
  });

  it('los nodos del stepper ya no son interactivos (no se puede navegar entre estados)', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'analisis' }}
        onUpdate={vi.fn()}
      />
    );

    const item = screen.getByText('Planificación').closest('li');
    expect(item?.querySelector('button')).toBeNull();
  });

  it('cuando el estado actual es Resuelto, los 5 pasos de trabajo se muestran completados', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={vi.fn()}
      />
    );

    ['Análisis', 'Planificación', 'En cola', 'Desarrollo', 'Revisión'].forEach((label) => {
      expect(getStepGlyph(label)).toBe('✓');
    });
  });

  describe('Cancelado: pasos sin actividad registrada muestran × en vez de ✓', () => {
    it('muestra × en los pasos que el requisito nunca alcanzó según el historial de actividad', () => {
      render(
        <RequirementStatusCard
          requirement={{
            ...baseRequirement,
            state: 'cancelado',
            activity: [
              {
                id: 1,
                typeOfActivity: 'state',
                previousValue: 'analisis',
                newValue: 'planificacion',
                visibilityLevel: 'internal',
                changedBy: 'u1',
                changedByUser: { id: 'u1', name: 'x', email: 'x' },
                createdAt: '2026-06-02T00:00:00Z',
                editedAt: null,
                editedBy: null,
              },
              {
                id: 2,
                typeOfActivity: 'state',
                previousValue: 'planificacion',
                newValue: 'cancelado',
                visibilityLevel: 'internal',
                changedBy: 'u1',
                changedByUser: { id: 'u1', name: 'x', email: 'x' },
                createdAt: '2026-06-03T00:00:00Z',
                editedAt: null,
                editedBy: null,
              },
            ],
          }}
          onUpdate={vi.fn()}
        />
      );

      expect(getStepGlyph('Análisis')).toBe('✓');
      expect(getStepGlyph('Planificación')).toBe('✓');
      expect(getStepGlyph('En cola')).toBe('×');
      expect(getStepGlyph('Desarrollo')).toBe('×');
      expect(getStepGlyph('Revisión')).toBe('×');
    });

    it('sin ningún historial de actividad, solo Análisis (estado inicial) se muestra completado', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'cancelado', activity: [] }}
          onUpdate={vi.fn()}
        />
      );

      expect(getStepGlyph('Análisis')).toBe('✓');
      expect(getStepGlyph('Planificación')).toBe('×');
      expect(getStepGlyph('En cola')).toBe('×');
      expect(getStepGlyph('Desarrollo')).toBe('×');
      expect(getStepGlyph('Revisión')).toBe('×');
    });
  });

  describe('Descripción del paso — siempre corresponde al estado real, no navegable', () => {
    it('Análisis: muestra el texto descriptivo del estado actual', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      expect(
        screen.getByText(/se entiende el requerimiento y se define el alcance/i)
      ).toBeInTheDocument();
    });

    it('Planificación: muestra el texto descriptivo del estado actual', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion' }}
          onUpdate={vi.fn()}
        />
      );

      expect(
        screen.getByText(/se define la propuesta y los criterios de aceptación/i)
      ).toBeInTheDocument();
    });

    it('En cola: muestra el texto descriptivo del estado actual', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'en_cola' }}
          onUpdate={vi.fn()}
        />
      );

      expect(
        screen.getByText(/se prioriza el orden de trabajo entre los requisitos planificados/i)
      ).toBeInTheDocument();
    });

    it('Desarrollo: muestra el texto descriptivo del estado actual', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(
        screen.getByText(/se ejecuta la solución definida en planificación/i)
      ).toBeInTheDocument();
    });

    it('Revisión: muestra el texto descriptivo del estado actual', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision' }}
          onUpdate={vi.fn()}
        />
      );

      expect(
        screen.getByText(/se valida la implementación con el cliente o responsable/i)
      ).toBeInTheDocument();
    });

    it('Resuelto: muestra el texto descriptivo del estado actual', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'resuelto' }}
          onUpdate={vi.fn()}
        />
      );

      expect(
        screen.getByText(/el requisito fue resuelto y no requiere más trabajo/i)
      ).toBeInTheDocument();
    });

    it('click en un nodo del stepper no cambia la descripción mostrada', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      // El stepper es informativo (`interactive` en su default `false`): no hay ningún
      // <button> que clickear dentro del <li>, así que se dispara el click sobre el propio
      // <li> — verifica que no exista ningún manejador que reaccione a eso.
      const item = screen.getByText('Revisión').closest('li');
      if (item) fireEvent.click(item);

      expect(
        screen.getByText(/se entiende el requerimiento y se define el alcance/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/se valida la implementación con el cliente o responsable/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Título de la card muestra el estado actual', () => {
    it('muestra "Estado - Desarrollo" cuando el requisito está en Desarrollo', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('Estado - Desarrollo')).toBeInTheDocument();
    });

    it('muestra "Estado - Resuelto" cuando el requisito está Resuelto', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'resuelto' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('Estado - Resuelto')).toBeInTheDocument();
    });
  });

  describe('Placeholders por campo', () => {
    it('Alcance tiene el placeholder correspondiente', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={vi.fn()}
        />
      );

      openField('Alcance');
      expect(screen.getByLabelText('Alcance')).toHaveAttribute(
        'placeholder',
        'Qué se acordó con el cliente / qué entendió el equipo, y cómo impacta...'
      );
    });

    it('Propuesta tiene el placeholder correspondiente', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion', technicalSolution: null }}
          onUpdate={vi.fn()}
        />
      );

      openField('Propuesta');
      expect(screen.getByLabelText('Propuesta')).toHaveAttribute(
        'placeholder',
        'Describí el enfoque técnico...'
      );
    });

    it('Criterios de aceptación tiene el placeholder correspondiente', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion', acceptanceCriteria: null }}
          onUpdate={vi.fn()}
        />
      );

      openField('Criterios de aceptación');
      expect(screen.getByLabelText('Criterios de aceptación')).toHaveAttribute(
        'placeholder',
        '¿Qué se espera que pase? ¿Cómo se determina el éxito?'
      );
    });
  });

  describe('Alcance, Propuesta, Criterios de aceptación y Cierre estimado siempre visibles', () => {
    it('en cualquier estado se ven los 4 campos (S-087: el correspondiente al state real arranca desplegado)', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      ['Alcance', 'Propuesta', 'Criterios de aceptación', 'Cierre estimado'].forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
      // Análisis (CA-2): "Alcance" arranca desplegado; el resto permanece cerrado.
      expect(screen.getByLabelText('Alcance')).toBeInTheDocument();
      expect(screen.queryByLabelText('Propuesta')).not.toBeVisible();
      expect(screen.queryByLabelText('Criterios de aceptación')).not.toBeVisible();
      expect(screen.queryByLabelText('Cierre estimado')).not.toBeVisible();
    });

    it('en Planificación se siguen viendo los 4 campos', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('Alcance')).toBeInTheDocument();
      expect(screen.getByText('Propuesta')).toBeInTheDocument();
      expect(screen.getByText('Criterios de aceptación')).toBeInTheDocument();
      expect(screen.getByText('Cierre estimado')).toBeInTheDocument();
    });

    it('Cierre estimado se muestra en cualquier estado, no solo En cola', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'resuelto' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('Cierre estimado')).toBeInTheDocument();
    });

    it('Desarrollo: Criterios de aceptación se ve editable, no en modo solo lectura', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo', acceptanceCriteria: 'Crit Z' }}
          onUpdate={vi.fn()}
        />
      );

      openField('Criterios de aceptación');
      fireEvent.click(within(getFieldRegion('Criterios de aceptación')).getByText('Editar'));

      expect(screen.getByLabelText('Criterios de aceptación')).toHaveValue('Crit Z');
    });

    it('Revisión: se siguen viendo los 3 campos aunque no tenga descripción propia de campos', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('Alcance')).toBeInTheDocument();
      expect(screen.getByText('Propuesta')).toBeInTheDocument();
      expect(screen.getByText('Criterios de aceptación')).toBeInTheDocument();
    });

    it('cada campo se puede expandir y volver a colapsar de forma independiente', () => {
      // Estado "desarrollo": ningún campo arranca desplegado por defecto (CA-5), por lo
      // que sirve para probar el toggle manual de expandir/colapsar sin interferencia
      // del despliegue automático por state (CA-2 a CA-4).
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo', scope: null }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();

      openField('Alcance');
      expect(screen.getByLabelText('Alcance')).toBeInTheDocument();
      expect(screen.queryByLabelText('Propuesta')).not.toBeVisible();

      fireEvent.click(screen.getByText('Alcance').closest('button')!);
      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();
    });
  });

  describe('S-087 (CA-2 a CA-5): el campo desplegado por defecto sigue al state real', () => {
    it('CA-2: en Análisis, "Alcance" arranca desplegado y el resto colapsado', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Alcance')).toBeInTheDocument();
      expect(screen.queryByLabelText('Propuesta')).not.toBeVisible();
      expect(screen.queryByLabelText('Criterios de aceptación')).not.toBeVisible();
      expect(screen.queryByLabelText('Cierre estimado')).not.toBeVisible();
    });

    it('CA-3: en Planificación, "Propuesta" y "Criterios de aceptación" arrancan desplegados', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Propuesta')).toBeInTheDocument();
      expect(screen.getByLabelText('Criterios de aceptación')).toBeInTheDocument();
      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();
      expect(screen.queryByLabelText('Cierre estimado')).not.toBeVisible();
    });

    it('CA-4: en En cola, "Cierre estimado" arranca desplegado y el resto colapsado', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'en_cola' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Cierre estimado')).toBeInTheDocument();
      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();
      expect(screen.queryByLabelText('Propuesta')).not.toBeVisible();
      expect(screen.queryByLabelText('Criterios de aceptación')).not.toBeVisible();
    });

    it('CA-5: en Desarrollo, ningún campo arranca desplegado', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();
      expect(screen.queryByLabelText('Propuesta')).not.toBeVisible();
      expect(screen.queryByLabelText('Criterios de aceptación')).not.toBeVisible();
      expect(screen.queryByLabelText('Cierre estimado')).not.toBeVisible();
    });

    it('CA-5: en Revisión, ningún campo arranca desplegado', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();
      expect(screen.queryByLabelText('Propuesta')).not.toBeVisible();
      expect(screen.queryByLabelText('Criterios de aceptación')).not.toBeVisible();
    });

    it('al transicionar exitosamente (nuevo prop requirement con state actualizado), el despliegue se resincroniza al nuevo paso', () => {
      const { rerender } = render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Alcance')).toBeInTheDocument();

      rerender(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();
      expect(screen.getByLabelText('Propuesta')).toBeInTheDocument();
      expect(screen.getByLabelText('Criterios de aceptación')).toBeInTheDocument();
    });

    it('el usuario puede colapsar manualmente un campo desplegado por defecto', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Alcance')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Alcance').closest('button')!);

      expect(screen.queryByLabelText('Alcance')).not.toBeVisible();
    });
  });

  describe('Botón de transición — solo avanza al siguiente paso natural del flujo', () => {
    it('en Análisis, el botón dice "Pasar a Planificación"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /pasar a planificación/i })).toBeInTheDocument();
    });

    it('en Planificación, el botón dice "Pasar a En cola"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /pasar a en cola/i })).toBeInTheDocument();
    });

    it('en En cola, el botón dice "Pasar a Desarrollo"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'en_cola' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /pasar a desarrollo/i })).toBeInTheDocument();
    });

    it('en Desarrollo, el botón dice "Pasar a Revisión"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /pasar a revisión/i })).toBeInTheDocument();
    });

    it('en Revisión, sin siguiente paso de trabajo, no muestra botón de transición', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /pasar a/i })).not.toBeInTheDocument();
    });

    it('no existe ningún botón "Volver a" — no se puede retroceder de estado desde el stepper', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /volver a/i })).not.toBeInTheDocument();
    });

    it('click en el botón de transición dispara onUpdate con el siguiente estado del flujo', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /pasar a planificación/i }));
      expect(onUpdate).toHaveBeenCalledWith({ state: 'planificacion' });
    });

    it('click en el botón de transición dispara onUpdate con el state correspondiente, sin modal', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'desarrollo' }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /pasar a revisión/i }));

      expect(onUpdate).toHaveBeenCalledWith({ state: 'revision' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Con siguiente paso disponible, "Pasar a X" guarda los campos y transiciona junto', () => {
    it('S-087 (corrección): con siguiente paso disponible, "Guardar" y "Pasar a X" se muestran juntos, no mutuamente excluyentes', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /^guardar$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pasar a planificación/i })).toBeInTheDocument();
    });

    it('S-087: "Guardar" persiste solo los campos cambiados sin transicionar, incluso con siguiente paso disponible', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      fireEvent.change(screen.getByLabelText('Alcance'), {
        target: { value: 'Nuevo alcance sin transicionar' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

      expect(onUpdate).toHaveBeenCalledWith({ scope: 'Nuevo alcance sin transicionar' });
      expect(onUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ state: expect.anything() })
      );
    });

    it('TS-6: editar Alcance y hacer click en "Pasar a X" guarda el texto y transiciona en un único onUpdate', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'Nuevo alcance' } });
      fireEvent.click(screen.getByRole('button', { name: /pasar a planificación/i }));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith({ scope: 'Nuevo alcance', state: 'planificacion' });
    });

    it('borrar por completo un campo que tenía contenido y transicionar envía null, no ""', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: 'Alcance existente' }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      fireEvent.click(within(getFieldRegion('Alcance')).getByText('Editar'));
      fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /pasar a planificación/i }));

      expect(onUpdate).toHaveBeenCalledWith({ scope: null, state: 'planificacion' });
    });

    it('TS-8: editar Criterios de aceptación y hacer click en "Pasar a X" guarda y transiciona junto', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion' }}
          onUpdate={onUpdate}
        />
      );

      openField('Criterios de aceptación');
      fireEvent.change(screen.getByLabelText('Criterios de aceptación'), {
        target: { value: 'Debe soportar 100 req/s' },
      });
      fireEvent.click(screen.getByRole('button', { name: /pasar a en cola/i }));

      expect(onUpdate).toHaveBeenCalledWith({
        acceptanceCriteria: 'Debe soportar 100 req/s',
        state: 'en_cola',
      });
    });

    it('sin cambios en los campos, "Pasar a X" solo envía el nuevo state', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: 'Alcance original' }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /pasar a planificación/i }));

      expect(onUpdate).toHaveBeenCalledWith({ state: 'planificacion' });
    });

    it('editar Alcance, Propuesta y Criterios de aceptación y pasar de estado dispara un único onUpdate con los 3 campos + state', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      openField('Propuesta');
      openField('Criterios de aceptación');
      fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'Nuevo alcance' } });
      fireEvent.change(screen.getByLabelText('Propuesta'), {
        target: { value: 'Nueva propuesta' },
      });
      fireEvent.change(screen.getByLabelText('Criterios de aceptación'), {
        target: { value: 'Nuevo criterio' },
      });
      fireEvent.click(screen.getByRole('button', { name: /pasar a planificación/i }));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith({
        scope: 'Nuevo alcance',
        technicalSolution: 'Nueva propuesta',
        acceptanceCriteria: 'Nuevo criterio',
        state: 'planificacion',
      });
    });
  });

  describe('Sin siguiente paso (Revisión), "Guardar" persiste los campos sin transicionar', () => {
    it('en Revisión se muestra el botón "Guardar" en vez de "Pasar a X"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /^guardar$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /pasar a/i })).not.toBeInTheDocument();
    });

    it('editar Alcance en Revisión y hacer click en "Guardar" envía solo el campo cambiado, sin state', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision', scope: null }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'Nuevo alcance' } });
      fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

      expect(onUpdate).toHaveBeenCalledWith({ scope: 'Nuevo alcance' });
    });

    it('sin cambios, "Guardar" no dispara onUpdate', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision', scope: 'Alcance original' }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  // Corrige bug reportado: antes, cambiar el campo disparaba onUpdate inmediatamente
  // (auto-guardado), perdiendo cualquier cambio pendiente sin guardar en otros campos.
  // Ahora se comporta igual que Alcance/Propuesta/Criterios: solo actualiza el draft
  // local, y se persiste recién al hacer click en "Guardar".
  it('edición del campo Cierre estimado NO guarda automáticamente — solo con el botón Guardar', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'en_cola', estimatedFinishDate: null }}
        onUpdate={onUpdate}
      />
    );

    openField('Cierre estimado');
    fireEvent.change(screen.getByLabelText('Cierre estimado'), {
      target: { value: '2026-08-01' },
    });

    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(onUpdate).toHaveBeenCalledWith({ estimatedFinishDate: '2026-08-01' });
  });

  it('guardar Cierre estimado junto con otro campo modificado los persiste en una sola mutación', () => {
    const onUpdate = vi.fn();
    render(
      <RequirementStatusCard
        requirement={{
          ...baseRequirement,
          state: 'analisis',
          estimatedFinishDate: null,
          scope: null,
        }}
        onUpdate={onUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'Nuevo alcance' } });
    openField('Cierre estimado');
    fireEvent.change(screen.getByLabelText('Cierre estimado'), {
      target: { value: '2026-08-01' },
    });

    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    expect(onUpdate).toHaveBeenCalledWith({
      scope: 'Nuevo alcance',
      estimatedFinishDate: '2026-08-01',
    });
  });

  describe('S-086: toggle Editar/Vista previa en los campos markdown', () => {
    it('TS-1: Alcance muestra el toggle Editar/Vista previa y alterna a Vista previa', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={vi.fn()}
        />
      );

      openField('Alcance');
      expect(screen.getByLabelText('Alcance')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Alcance'), {
        target: { value: '## Objetivo\n\nMejorar el flujo' },
      });
      fireEvent.click(within(getFieldRegion('Alcance')).getByText('Vista previa'));

      // En modo Vista previa, MarkdownEditorWithPreview desmonta el <textarea> por completo.
      expect(screen.queryByLabelText('Alcance')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Objetivo' })).toBeInTheDocument();
      expect(within(getFieldRegion('Alcance')).getByText('Vista previa')).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });

    it('TS-2: vuelve a Editar sin perder el texto ingresado', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={vi.fn()}
        />
      );

      openField('Alcance');
      fireEvent.change(screen.getByLabelText('Alcance'), {
        target: { value: 'Texto sin guardar' },
      });
      const alcanceRegion = getFieldRegion('Alcance');
      fireEvent.click(within(alcanceRegion).getByText('Vista previa'));
      fireEvent.click(within(alcanceRegion).getByText('Editar'));

      expect(screen.getByLabelText('Alcance')).toHaveValue('Texto sin guardar');
    });

    it('TS-3: Vista previa de Alcance vacío muestra el placeholder, no un renderizado vacío', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={vi.fn()}
        />
      );

      openField('Alcance');
      fireEvent.click(within(getFieldRegion('Alcance')).getByText('Vista previa'));

      expect(
        screen.getByText('Qué se acordó con el cliente / qué entendió el equipo, y cómo impacta...')
      ).toBeInTheDocument();
    });

    it('TS-4: Vista previa de Propuesta vacío muestra su placeholder', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion', technicalSolution: null }}
          onUpdate={vi.fn()}
        />
      );

      // En planificación, Propuesta y Criterios de aceptación arrancan ambos desplegados
      // (CA-3) — se escopa el click al contenedor de "Propuesta" específicamente.
      openField('Propuesta');
      const propuestaContainer = screen
        .getByLabelText('Propuesta')
        .closest('[role="region"]') as HTMLElement;
      fireEvent.click(within(propuestaContainer).getByText('Vista previa'));

      expect(screen.getByText('Describí el enfoque técnico...')).toBeInTheDocument();
    });

    it('TS-5: Vista previa de Criterios de aceptación vacío muestra su placeholder', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion', acceptanceCriteria: null }}
          onUpdate={vi.fn()}
        />
      );

      // En planificación, Propuesta y Criterios de aceptación arrancan ambos desplegados
      // (CA-3) — se escopa el click al contenedor de "Criterios de aceptación" específicamente.
      openField('Criterios de aceptación');
      const criteriosContainer = screen
        .getByLabelText('Criterios de aceptación')
        .closest('[role="region"]') as HTMLElement;
      fireEvent.click(within(criteriosContainer).getByText('Vista previa'));

      expect(
        screen.getByText('¿Qué se espera que pase? ¿Cómo se determina el éxito?')
      ).toBeInTheDocument();
    });

    it('TS-6 (ajustado): con valor ya guardado, el modo por defecto al expandir es Vista previa', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: 'texto ya guardado' }}
          onUpdate={vi.fn()}
        />
      );

      openField('Alcance');
      const alcanceRegion = getFieldRegion('Alcance');

      // En modo Vista previa, MarkdownEditorWithPreview desmonta el <textarea> por completo
      // (no lo oculta): no hay ningún control con label "Alcance" en el DOM.
      expect(screen.queryByLabelText('Alcance')).not.toBeInTheDocument();
      expect(within(alcanceRegion).getByText('Vista previa')).toHaveAttribute(
        'aria-checked',
        'true'
      );
      expect(screen.getByTestId('markdown-viewer')).toHaveTextContent('texto ya guardado');
    });

    it('TS-6b: sin valor guardado, el modo por defecto al expandir sigue siendo Editar', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={vi.fn()}
        />
      );

      openField('Alcance');

      expect(screen.getByLabelText('Alcance')).toHaveValue('');
      expect(within(getFieldRegion('Alcance')).getByText('Editar')).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });

    it('TS-7: Guardar funciona igual estando el campo en modo Vista previa', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision', scope: null }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'nuevo texto' } });
      fireEvent.click(within(getFieldRegion('Alcance')).getByText('Vista previa'));
      fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

      expect(onUpdate).toHaveBeenCalledWith({ scope: 'nuevo texto' });
    });

    it('TS-8: Guardar con varios campos modificados, algunos en Vista previa, envía todos en un único onUpdate', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'revision' }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'alcance nuevo' } });

      openField('Propuesta');
      fireEvent.change(screen.getByLabelText('Propuesta'), {
        target: { value: 'propuesta nueva' },
      });
      const propuestaContainer = screen
        .getByLabelText('Propuesta')
        .closest('[role="region"]') as HTMLElement;
      fireEvent.click(within(propuestaContainer).getByText('Vista previa'));

      fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith({
        scope: 'alcance nuevo',
        technicalSolution: 'propuesta nueva',
      });
    });

    it('TS-9: alternar el toggle no dispara onUpdate', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      const alcanceRegion = getFieldRegion('Alcance');
      fireEvent.click(within(alcanceRegion).getByText('Vista previa'));
      fireEvent.click(within(alcanceRegion).getByText('Editar'));

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('TS-10: el toggle es independiente por campo', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'planificacion' }}
          onUpdate={vi.fn()}
        />
      );

      openField('Alcance');
      openField('Propuesta');

      const toggles = screen.getAllByText('Vista previa');
      fireEvent.click(toggles[0]);

      expect(screen.getByLabelText('Propuesta')).toBeInTheDocument();
    });

    it('TS-11: el campo de fecha (Cierre estimado) no tiene toggle Editar/Vista previa', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'en_cola' }}
          onUpdate={vi.fn()}
        />
      );

      openField('Cierre estimado');

      expect(
        within(getFieldRegion('Cierre estimado')).queryByText('Vista previa')
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('Cierre estimado')).toHaveAttribute('type', 'date');
    });
  });

  describe('El stepper siempre muestra los 5 pasos de trabajo, sin recortar por tipo (REQ-012)', () => {
    it('TS-12: type=incidencia en Desarrollo sigue mostrando los 5 pasos, "En cola" incluido', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('En cola')).toBeInTheDocument();
      expect(document.querySelectorAll('ol[aria-label="Progreso del requisito"] li')).toHaveLength(5);
      ['Análisis', 'Planificación', 'En cola', 'Desarrollo', 'Revisión'].forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('type=incidencia en Planificación: el botón de transición dice "Pasar a Desarrollo" (salta En cola)', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'planificacion' }}
          onUpdate={onUpdate}
        />
      );

      const button = screen.getByRole('button', { name: /pasar a desarrollo/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(onUpdate).toHaveBeenCalledWith({ state: 'desarrollo' });
    });

    it('TS-11: type distinto de incidencia sigue mostrando 5 pasos con "En cola"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, type: 'funcionalidad', state: 'desarrollo' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('En cola')).toBeInTheDocument();
      expect(document.querySelectorAll('ol[aria-label="Progreso del requisito"] li')).toHaveLength(5);
    });

    it('TS-15: incidencia ya en "En cola" (dato heredado) sigue mostrando el stepper completo con ese paso como actual', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, type: 'incidencia', state: 'en_cola' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByText('En cola')).toBeInTheDocument();
      expect(document.querySelectorAll('ol[aria-label="Progreso del requisito"] li')).toHaveLength(5);
      const activeStep = screen.getByText('En cola').closest('[aria-current="step"]');
      expect(activeStep).not.toBeNull();
    });
  });

  describe('El botón de transición no desaparece en estado terminal — sugiere volver al trabajo (REQ-012, CA-3)', () => {
    it('TS-9: con state resuelto, existe "Pasar a Desarrollo" junto con "Guardar"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'resuelto' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /pasar a desarrollo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^guardar$/i })).toBeInTheDocument();
    });

    it('TS-10: con state cancelado, existe "Pasar a Desarrollo"', () => {
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'cancelado' }}
          onUpdate={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /pasar a desarrollo/i })).toBeInTheDocument();
    });

    it('TS-11: click en "Pasar a Desarrollo" desde resuelto llama a onUpdate con state desarrollo y sin campos de resolución', () => {
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{
            ...baseRequirement,
            state: 'resuelto',
            resolutionType: 'error_interno',
            resolutionConclusion: 'Se corrigió el cálculo',
            resolutionComment: 'Ya está disponible',
          }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /pasar a desarrollo/i }));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const payload = onUpdate.mock.calls[0][0];
      expect(payload.state).toBe('desarrollo');
      expect(payload).not.toHaveProperty('resolutionType');
      expect(payload).not.toHaveProperty('resolutionConclusion');
      expect(payload).not.toHaveProperty('resolutionComment');
    });
  });

  describe('S-087: rollback en error de transición (CA-8, CA-9)', () => {
    it('TS-10: tras un intento de transición fallido, el stepper sigue reflejando el state previo', () => {
      // RequirementStatusCard ya deriva `state` directamente del prop `requirement`
      // (const {state} = requirement, sin useState propio) — si la mutación falla,
      // el rollback de useUpdateRequirement (Tarea 1) evita que el cache llegue a
      // reflejar el estado nuevo, por lo que el prop nunca cambia y el stepper nunca
      // se desincroniza. Este test confirma ese comportamiento explícitamente para S-087.
      const onUpdate = vi.fn();
      render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis' }}
          onUpdate={onUpdate}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /pasar a planificación/i }));

      // El componente no muta su propio estado visual al hacer click — solo dispara
      // onUpdate. Si la mutación (fuera de este componente) falla, el prop requirement
      // nunca llega a cambiar, así que el stepper sigue en "Análisis" sin ningún cambio.
      const activeStep = screen.getByText('Análisis').closest('[aria-current="step"]');
      expect(activeStep).not.toBeNull();
      expect(onUpdate).toHaveBeenCalledWith({ state: 'planificacion' });
    });

    it('TS-13: un draft de texto sin guardar sobrevive a un rollback (el rollback no debe borrar texto no guardado)', () => {
      const onUpdate = vi.fn();
      const { rerender } = render(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={onUpdate}
        />
      );

      openField('Alcance');
      fireEvent.change(screen.getByLabelText('Alcance'), {
        target: { value: 'texto sin guardar' },
      });

      // El usuario intenta una transición (sin guardar antes) que termina fallando —
      // como el rollback de useUpdateRequirement evita que el cache cambie, el
      // `requirement` prop sigue siendo exactamente el mismo objeto/valores.
      fireEvent.click(screen.getByRole('button', { name: /pasar a planificación/i }));
      rerender(
        <RequirementStatusCard
          requirement={{ ...baseRequirement, state: 'analisis', scope: null }}
          onUpdate={onUpdate}
        />
      );

      // El draft no guardado sigue presente — el rollback solo afecta el `state`
      // persistido, nunca el texto que el usuario todavía no confirmó con "Guardar".
      expect(screen.getByLabelText('Alcance')).toHaveValue('texto sin guardar');
    });
  });
});

// S-057 (Task 1) — TS-5 a TS-8: fijan el comportamiento del stepper contra el código SIN
// MIGRAR. Tienen que seguir pasando sin modificarse una vez migrado a componente `Stepper`
// (Task 5).
describe('S-057: preservación de comportamiento (CA-3) — stepper de 5 pasos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-5: el stepper muestra cinco pasos, nunca siete', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    const steps = screen.getAllByText(
      /^(Análisis|Planificación|En cola|Desarrollo|Revisión)$/
    );
    expect(steps).toHaveLength(5);
    expect(screen.queryByText('Resuelto')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancelado')).not.toBeInTheDocument();
  });

  it('TS-6: en estado terminal resuelto el stepper marca los cinco pasos como recorridos', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'resuelto' }}
        onUpdate={vi.fn()}
      />
    );

    ['Análisis', 'Planificación', 'En cola', 'Desarrollo', 'Revisión'].forEach((label) => {
      expect(getStepGlyph(label)).toBe('✓');
    });
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it('TS-7: en cancelado los pasos no trabajados se dibujan con × y los recorridos con ✓', () => {
    render(
      <RequirementStatusCard
        requirement={{
          ...baseRequirement,
          state: 'cancelado',
          activity: [
            {
              id: 1,
              typeOfActivity: 'state',
              previousValue: 'analisis',
              newValue: 'planificacion',
              visibilityLevel: 'internal',
              changedBy: 'u1',
              changedByUser: { id: 'u1', name: 'x', email: 'x' },
              createdAt: '2026-06-02T00:00:00Z',
              editedAt: null,
              editedBy: null,
            },
          ],
        }}
        onUpdate={vi.fn()}
      />
    );

    expect(getStepGlyph('Análisis')).toBe('✓');
    expect(getStepGlyph('Planificación')).toBe('✓');
    expect(getStepGlyph('En cola')).toBe('×');
    expect(getStepGlyph('Desarrollo')).toBe('×');
    expect(getStepGlyph('Revisión')).toBe('×');
  });

  it('TS-8: el stepper es informativo — ningún nodo es un button ni es focusable', () => {
    render(
      <RequirementStatusCard
        requirement={{ ...baseRequirement, state: 'desarrollo' }}
        onUpdate={vi.fn()}
      />
    );

    ['Análisis', 'Planificación', 'En cola', 'Desarrollo', 'Revisión'].forEach((label) => {
      const item = screen.getByText(label).closest('li');
      expect(item?.querySelector('button')).toBeNull();
    });
  });

  it('TS-16: las cabeceras de acordeón distinguen campo completo de pendiente por glifo', () => {
    // 2 completos (Alcance, Propuesta) y 2 vacíos (Criterios, Cierre estimado): el glifo
    // ✓ / ! distingue el estado sin depender del color, que es lo que exige el DS.
    render(
      <RequirementStatusCard
        requirement={{
          ...baseRequirement,
          state: 'desarrollo',
          scope: 'Alcance acordado con el cliente',
          technicalSolution: 'Enfoque técnico definido',
          acceptanceCriteria: '',
          estimatedFinishDate: null,
        }}
        onUpdate={vi.fn()}
      />
    );

    const glyphOf = (label: string): string | undefined =>
      screen
        .getByText(label)
        .closest('button')
        ?.querySelector('[aria-hidden="true"]')
        ?.textContent?.trim();

    expect(glyphOf('Alcance')).toBe('✓');
    expect(glyphOf('Propuesta')).toBe('✓');
    expect(glyphOf('Criterios de aceptación')).toBe('!');
    expect(glyphOf('Cierre estimado')).toBe('!');
  });
});
