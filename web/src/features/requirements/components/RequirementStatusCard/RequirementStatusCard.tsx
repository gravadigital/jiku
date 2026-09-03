'use client';

import { useEffect, useState } from 'react';
import { Accordion, Button, Card, Stepper } from '@/shared/components/ui';
import { MarkdownEditorWithPreview } from '@/shared/components/ui/MarkdownEditorWithPreview';
import styles from './RequirementStatusCard.module.scss';
import type {
  Requirement,
  RequirementState,
  UpdateRequirementPayload,
} from '../../types/requirement.types';
import type { StepperStep } from '@/shared/components/ui/Stepper';

interface RequirementStatusCardProps {
  readonly requirement: Requirement;
  readonly onUpdate: (payload: UpdateRequirementPayload) => void;
  readonly isPending?: boolean;
}

// Los cinco pasos de trabajo son fijos: resuelto/cancelado NO son nodos del stepper — son
// estados de cierre que se ven en el badge (RequirementHeader) y se alcanzan desde la card
// de resolución (RequirementResolutionCard).
const STEPS: readonly StepperStep[] = [
  { key: 'analisis', label: 'Análisis' },
  { key: 'planificacion', label: 'Planificación' },
  { key: 'en_cola', label: 'En cola' },
  { key: 'desarrollo', label: 'Desarrollo' },
  { key: 'revision', label: 'Revisión' },
];

const WORK_STEP_KEYS = STEPS.map((step) => step.key) as RequirementState[];

const STATE_LABELS: Record<RequirementState, string> = {
  analisis: 'Análisis',
  planificacion: 'Planificación',
  en_cola: 'En cola',
  desarrollo: 'Desarrollo',
  revision: 'Revisión',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
};

// Siguiente paso del flujo natural de trabajo — el botón de transición es un atajo al
// destino habitual, no la única salida posible (desde REQ-012 cualquier estado se
// alcanza libremente desde la pill). "Revisión" sigue sin destino sugerido acá: cerrar
// el requisito vive en RequirementResolutionCard. Resuelto/Cancelado sugieren volver al
// trabajo (mismo destino que "Reabrir"), para no ofrecer dos vueltas distintas a lo mismo.
const NEXT_WORK_STEP: Partial<Record<RequirementState, RequirementState>> = {
  analisis: 'planificacion',
  planificacion: 'en_cola',
  en_cola: 'desarrollo',
  desarrollo: 'revision',
  resuelto: 'desarrollo',
  cancelado: 'desarrollo',
};

// Para incidencias, "En cola" no forma parte del recorrido habitual — Planificación
// sugiere Desarrollo directo, por costumbre y no por restricción (el servidor ya no
// distingue por tipo). No se ofrece atajo desde en_cola porque una incidencia nueva
// nunca debería llegar ahí; si ya está en en_cola por dato heredado, el paso se sigue
// mostrando pero no se ofrece un "siguiente paso" automático desde él.
const NEXT_WORK_STEP_INCIDENCIA: Partial<Record<RequirementState, RequirementState>> = {
  analisis: 'planificacion',
  planificacion: 'desarrollo',
  desarrollo: 'revision',
  resuelto: 'desarrollo',
  cancelado: 'desarrollo',
};

// Un paso de trabajo tuvo actividad real si aparece como origen o destino de alguna
// transición de estado en el historial, o si es el estado inicial de creación
// (`analisis`, default de la API — nunca genera su propia entrada de "llegada").
function hasStepActivity(step: RequirementState, requirement: Requirement): boolean {
  if (step === 'analisis') return true;
  const stateChanges = (requirement.activity ?? []).filter(
    (entry) => entry.typeOfActivity === 'state'
  );
  return stateChanges.some((entry) => entry.previousValue === step || entry.newValue === step);
}

const STEP_DESCRIPTIONS: Partial<Record<RequirementState, string>> = {
  analisis: 'Se entiende el requerimiento y se define el alcance.',
  planificacion: 'Se define la propuesta y los criterios de aceptación.',
  en_cola: 'Se prioriza el orden de trabajo entre los requisitos planificados.',
  desarrollo: 'Se ejecuta la solución definida en Planificación.',
  revision: 'Se valida la implementación con el cliente o responsable.',
  resuelto: 'El requisito fue resuelto y no requiere más trabajo.',
};

function getTransitionLabel(target: RequirementState): string {
  return `Pasar a ${STATE_LABELS[target]}`;
}

type FieldDrafts = {
  scope: string;
  technicalSolution: string;
  acceptanceCriteria: string;
  estimatedFinishDate: string;
};

function draftsFromRequirement(requirement: Requirement): FieldDrafts {
  return {
    scope: requirement.scope ?? '',
    technicalSolution: requirement.technicalSolution ?? '',
    acceptanceCriteria: requirement.acceptanceCriteria ?? '',
    estimatedFinishDate: requirement.estimatedFinishDate?.slice(0, 10) ?? '',
  };
}

interface FieldConfig {
  key: keyof FieldDrafts;
  label: string;
  placeholder?: string;
  inputType?: 'textarea' | 'date';
  value: (requirement: Requirement) => string | null;
}

const SAVABLE_FIELDS: (keyof FieldDrafts)[] = [
  'scope',
  'technicalSolution',
  'acceptanceCriteria',
  'estimatedFinishDate',
];

// Qué campos aparecen desplegados por defecto según el `state` real del requisito (CA-2 a
// CA-5) — Desarrollo/Revisión (y los estados terminales) no despliegan ningún campo por
// defecto, ya que en esos pasos no hay edición esperada de estos campos como flujo principal.
const DEFAULT_OPEN_FIELDS_BY_STATE: Partial<Record<RequirementState, (keyof FieldDrafts)[]>> = {
  analisis: ['scope'],
  planificacion: ['technicalSolution', 'acceptanceCriteria'],
  en_cola: ['estimatedFinishDate'],
};

const FIELDS: FieldConfig[] = [
  {
    key: 'scope',
    label: 'Alcance',
    placeholder: 'Qué se acordó con el cliente / qué entendió el equipo, y cómo impacta...',
    value: (r) => r.scope,
  },
  {
    key: 'technicalSolution',
    label: 'Propuesta',
    placeholder: 'Describí el enfoque técnico...',
    value: (r) => r.technicalSolution,
  },
  {
    key: 'acceptanceCriteria',
    label: 'Criterios de aceptación',
    placeholder: '¿Qué se espera que pase? ¿Cómo se determina el éxito?',
    value: (r) => r.acceptanceCriteria,
  },
  {
    key: 'estimatedFinishDate',
    label: 'Cierre estimado',
    inputType: 'date',
    value: (r) => r.estimatedFinishDate,
  },
];

export function RequirementStatusCard({
  requirement,
  onUpdate,
  isPending,
}: RequirementStatusCardProps) {
  const { state } = requirement;
  const [drafts, setDrafts] = useState<FieldDrafts>(() => draftsFromRequirement(requirement));

  // Alcance, Propuesta y Criterios de aceptación se muestran siempre, sin importar
  // el estado del requisito — al recibir un requirement actualizado (tras guardar)
  // los drafts se realinean con los valores reales.
  // Deps por VALOR (no [requirement]): un rollback de useUpdateRequirement (S-087) puede
  // re-renderizar con un objeto requirement de nueva referencia pero mismos valores — si
  // las deps fueran el objeto completo, esto pisaría con el valor persistido cualquier
  // draft de texto que el usuario todavía no guardó, perdiendo lo que estaba escribiendo.
  useEffect(() => {
    setDrafts(draftsFromRequirement(requirement));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    requirement.scope,
    requirement.technicalSolution,
    requirement.acceptanceCriteria,
    requirement.estimatedFinishDate,
  ]);

  const isIncidencia = requirement.type === 'incidencia';

  // El destino sugerido por el botón de transición — un atajo al paso siguiente
  // habitual, no la única transición posible (la pill ofrece las siete, sin recorte).
  const nextStepMap = isIncidencia ? NEXT_WORK_STEP_INCIDENCIA : NEXT_WORK_STEP;
  const transitionTarget = nextStepMap[state] ?? null;

  // Si el draft quedó vacío (el usuario borró todo el contenido), se envía null en
  // vez de "" — vaciar el campo de verdad, no un string vacío que el backend puede
  // rechazar en ciertos endpoints.
  const changedFieldsPayload = (): UpdateRequirementPayload => {
    const current = draftsFromRequirement(requirement);
    const changed = SAVABLE_FIELDS.filter((field) => drafts[field] !== current[field]);
    return Object.fromEntries(
      changed.map((field) => [field, drafts[field] === '' ? null : drafts[field]])
    ) as UpdateRequirementPayload;
  };

  // "Guardar" siempre está disponible (persiste solo los campos cambiados, sin
  // transicionar). Con siguiente paso disponible, "Pasar a X" convive con "Guardar" y
  // permite guardar + transicionar en una sola acción (S-087: dejaron de ser
  // mutuamente excluyentes). Desde REQ-012, Resuelto y Cancelado también sugieren un
  // destino (volver a Desarrollo): el único estado sin siguiente paso es Revisión —
  // el cierre desde ahí vive en RequirementResolutionCard, no en este botón.
  const handleTransition = () => {
    if (!transitionTarget) return;
    onUpdate({ ...changedFieldsPayload(), state: transitionTarget });
  };

  const handleDraftChange = (field: keyof FieldDrafts, value: string) => {
    setDrafts((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveFields = () => {
    const payload = changedFieldsPayload();
    if (Object.keys(payload).length === 0) return;
    onUpdate(payload);
  };

  // Un estado terminal (resuelto/cancelado) no es un nodo del stepper: `currentKey` queda
  // fuera de `steps`, así que se representa recorriendo los cinco pasos vía `doneKeys` —
  // sin esto, el cálculo por defecto de Stepper los dejaría todos en `pending`.
  const reachedTerminal = state === 'resuelto' || state === 'cancelado';
  const doneKeys = reachedTerminal ? WORK_STEP_KEYS : undefined;
  // Cancelado: los pasos "recorridos" sin actividad real registrada se marcan con × en vez
  // de ✓, para no sugerir que se completaron.
  const skippedKeys =
    state === 'cancelado'
      ? WORK_STEP_KEYS.filter((step) => !hasStepActivity(step, requirement))
      : undefined;

  return (
    <Card variant="panel" title={`Estado - ${STATE_LABELS[state]}`} headingLevel="h2">
      {STEP_DESCRIPTIONS[state] && <p className={styles.stepDesc}>{STEP_DESCRIPTIONS[state]}</p>}

      <div className={styles.stepperRow}>
        <Stepper steps={STEPS} currentKey={state} doneKeys={doneKeys} skippedKeys={skippedKeys} />
      </div>

      <div className={styles.panel}>
        <div className={styles.fieldGroup}>
          {FIELDS.map((field) => {
            const value = field.value(requirement);
            const met = !!value;
            const defaultExpanded = (DEFAULT_OPEN_FIELDS_BY_STATE[state] ?? []).includes(
              field.key
            );

            return (
              // `key` incluye el `state`: Accordion es no controlado (solo `defaultExpanded`
              // al montar), así que al transicionar de estado se remonta para resincronizar
              // el despliegue por defecto al nuevo paso (CA-2 a CA-5).
              <Accordion
                key={`${field.key}-${state}`}
                title={field.label}
                status={met ? 'done' : 'pending'}
                defaultExpanded={defaultExpanded}
                headingLevel="h4"
              >
                {field.inputType === 'date' ? (
                  <input
                    aria-label={field.label}
                    type="date"
                    className={styles.inlineFormInput}
                    value={drafts[field.key].slice(0, 10)}
                    onChange={(e) => handleDraftChange(field.key, e.target.value)}
                    disabled={isPending}
                  />
                ) : (
                  <MarkdownEditorWithPreview
                    ariaLabel={field.label}
                    value={drafts[field.key]}
                    onChange={(v) => handleDraftChange(field.key, v)}
                    placeholder={field.placeholder}
                    disabled={isPending}
                    initialMode={met ? 'preview' : 'edit'}
                  />
                )}
              </Accordion>
            );
          })}
        </div>

        <div className={styles.panelActions}>
          <Button variant="primary" onClick={handleSaveFields} disabled={isPending}>
            Guardar
          </Button>
          {transitionTarget && (
            <Button
              variant="flow"
              icon="→"
              iconTrailing
              onClick={handleTransition}
              disabled={isPending}
            >
              {getTransitionLabel(transitionTarget)}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
