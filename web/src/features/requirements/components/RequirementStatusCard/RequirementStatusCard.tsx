'use client';

import { useEffect, useState } from 'react';
import { MarkdownEditorWithPreview } from '@/shared/components/ui/MarkdownEditorWithPreview';
import styles from './RequirementStatusCard.module.scss';
import type {
  Requirement,
  RequirementState,
  UpdateRequirementPayload,
} from '../../types/requirement.types';

interface RequirementStatusCardProps {
  readonly requirement: Requirement;
  readonly onUpdate: (payload: UpdateRequirementPayload) => void;
  readonly isPending?: boolean;
}

interface StepDefinition {
  label: string;
  value: RequirementState;
}

const INLINE_STEPS: StepDefinition[] = [
  { label: 'Análisis', value: 'analisis' },
  { label: 'Planificación', value: 'planificacion' },
  { label: 'En cola', value: 'en_cola' },
  { label: 'Desarrollo', value: 'desarrollo' },
  { label: 'Revisión', value: 'revision' },
];

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

function getTransitionLabel(target: RequirementState, steps: StepDefinition[]): string {
  const label =
    steps.find((step) => step.value === target)?.label ??
    INLINE_STEPS.find((step) => step.value === target)?.label ??
    target;
  return `Pasar a ${label}`;
}

interface FieldAccordionProps {
  readonly label: string;
  readonly value: string | null;
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly inputType?: 'textarea' | 'date';
}

function FieldAccordion({
  label,
  value,
  draft,
  onDraftChange,
  placeholder,
  disabled,
  open,
  onToggle,
  inputType = 'textarea',
}: FieldAccordionProps) {
  const met = !!value;

  return (
    <div className={`${styles.accItem} ${met ? styles.fieldMet : styles.fieldMissing}`}>
      <button type="button" className={styles.accHead} onClick={onToggle} aria-expanded={open}>
        <span className={styles.fieldLabelRow}>
          <span className={styles.fieldIcon}>{met ? '✓' : '!'}</span>
          <span className={styles.fieldLabel}>{label}</span>
        </span>
        <span className={`${styles.accChevron} ${open ? styles.accChevronOpen : ''}`}>▾</span>
      </button>
      {open && (
        <div className={styles.accBody}>
          {inputType === 'date' ? (
            <input
              aria-label={label}
              type="date"
              className={styles.inlineFormInput}
              value={draft.slice(0, 10)}
              onChange={(e) => onDraftChange(e.target.value)}
              disabled={disabled}
            />
          ) : (
            <MarkdownEditorWithPreview
              ariaLabel={label}
              value={draft}
              onChange={onDraftChange}
              placeholder={placeholder}
              disabled={disabled}
              initialMode={met ? 'preview' : 'edit'}
            />
          )}
        </div>
      )}
    </div>
  );
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

function computeOpenFields(state: RequirementState): Record<keyof FieldDrafts, boolean> {
  const defaultOpen = DEFAULT_OPEN_FIELDS_BY_STATE[state] ?? [];
  return Object.fromEntries(FIELDS.map((f) => [f.key, defaultOpen.includes(f.key)])) as Record<
    keyof FieldDrafts,
    boolean
  >;
}

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
  const [openFields, setOpenFields] = useState<Record<keyof FieldDrafts, boolean>>(() =>
    computeOpenFields(requirement.state)
  );

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

  // El campo desplegado por defecto sigue al `state` real (CA-2 a CA-5) — al transicionar
  // (éxito real, no optimista) el panel correspondiente al nuevo paso se despliega
  // automáticamente y el resto vuelve a colapsarse, sin requerir click manual del usuario.
  useEffect(() => {
    setOpenFields(computeOpenFields(requirement.state));
  }, [requirement.state]);

  const toggleField = (field: keyof FieldDrafts) => {
    setOpenFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const isIncidencia = requirement.type === 'incidencia';

  // El stepper muestra siempre los cinco pasos de trabajo, para cualquier tipo: es
  // cómo el equipo lee dónde está el requisito. Desde REQ-012 ya no recorta a dónde se
  // puede ir — eso lo decide la pill de estado, no el stepper.
  const visibleSteps = INLINE_STEPS;

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

  const renderStep = (step: StepDefinition, i: number) => {
    const stepIdx = i;
    const currentIdx = visibleSteps.findIndex((s) => s.value === state);
    const isCurrent = state === step.value;
    // Si el estado actual es Resuelto/Cancelado, ya se superó todo el flujo de trabajo
    // para llegar ahí — los 5 pasos de trabajo se muestran superados (color/conector).
    const reachedTerminal = state === 'resuelto' || state === 'cancelado';
    const isDone = reachedTerminal || (currentIdx !== -1 && stepIdx < currentIdx);
    // Si terminó Cancelado, un paso "superado" sin actividad real registrada (nunca se
    // pasó por ahí) se marca con × en vez de ✓, para no sugerir que se completó.
    const skippedOnCancel =
      state === 'cancelado' && isDone && !hasStepActivity(step.value, requirement);

    return (
      <div
        key={step.value}
        className={styles.step}
        data-step={step.value}
        aria-current={isCurrent ? 'step' : undefined}
      >
        {i > 0 && (
          <div
            className={`${styles.stepConnector} ${isDone || isCurrent ? styles.stepConnectorDone : ''}`}
          />
        )}
        <div
          className={`${styles.stepDot} ${isCurrent ? styles.stepDotCurrent : ''} ${isDone ? styles.stepDotDone : ''}`}
          data-testid="step-dot"
        >
          {skippedOnCancel ? '×' : isDone ? '✓' : stepIdx + 1}
        </div>
        <span className={`${styles.stepLabel} ${isCurrent ? styles.stepLabelCurrent : ''}`}>
          {step.label}
        </span>
      </div>
    );
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Estado - {STATE_LABELS[state]}</div>
      {STEP_DESCRIPTIONS[state] && <p className={styles.stepDesc}>{STEP_DESCRIPTIONS[state]}</p>}

      <div className={styles.stepperRow}>
        <div className={styles.stepper}>{visibleSteps.map(renderStep)}</div>
      </div>

      <div className={styles.panel}>
        <div className={styles.fieldGroup}>
          {FIELDS.map((field) => (
            <FieldAccordion
              key={field.key}
              label={field.label}
              value={field.value(requirement)}
              draft={drafts[field.key]}
              onDraftChange={(value) => handleDraftChange(field.key, value)}
              placeholder={field.placeholder}
              inputType={field.inputType}
              disabled={isPending}
              open={openFields[field.key]}
              onToggle={() => toggleField(field.key)}
            />
          ))}
        </div>

        <div className={styles.panelActions}>
          <button
            type="button"
            className={styles.btnSmallPrimary}
            onClick={handleSaveFields}
            disabled={isPending}
          >
            Guardar
          </button>
          {transitionTarget && (
            <button
              type="button"
              className={styles.transitionButton}
              onClick={handleTransition}
              disabled={isPending}
            >
              {getTransitionLabel(transitionTarget, visibleSteps)} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
