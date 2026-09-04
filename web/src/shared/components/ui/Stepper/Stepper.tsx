'use client';
import React from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Stepper.module.scss';

export interface StepperStep {
  readonly key: string;
  readonly label: string;
}

export interface StepperProps {
  readonly steps: readonly StepperStep[];
  readonly currentKey: string;
  /**
   * Marca explícitamente pasos como recorridos aun cuando `currentKey` no es uno de
   * los `steps` (p. ej. un estado terminal como `resuelto`/`cancelado`, que no es un
   * nodo del stepper pero implica que se recorrió todo el flujo). Sin esta prop, el
   * cálculo por defecto compara el índice del paso contra el índice de `currentKey`
   * dentro de `steps`.
   */
  readonly doneKeys?: readonly string[];
  /**
   * De los pasos marcados como recorridos (por `doneKeys` o por el cálculo por
   * defecto), cuáles en realidad no tuvieron actividad real — se dibujan con `×` en
   * vez de `✓`, para no sugerir que se completaron (caso "cancelado" de S-050).
   */
  readonly skippedKeys?: readonly string[];
  /** Default `false`: informativo, no focusable, no ofrece cambio de estado. */
  readonly interactive?: boolean;
  readonly onStepChange?: (key: string) => void;
}

type NodeState = 'done' | 'current' | 'pending';

function resolveState(
  step: StepperStep,
  stepIndex: number,
  currentIndex: number,
  doneKeys: readonly string[] | undefined
): NodeState {
  if (doneKeys?.includes(step.key)) return 'done';
  if (currentIndex !== -1) {
    if (stepIndex === currentIndex) return 'current';
    if (stepIndex < currentIndex) return 'done';
  }
  return 'pending';
}

export function Stepper({
  steps,
  currentKey,
  doneKeys,
  skippedKeys,
  interactive = false,
  onStepChange,
}: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.key === currentKey);

  return (
    <ol className={styles.stepper} aria-label="Progreso del requisito">
      {steps.map((step, index) => {
        const state = resolveState(step, index, currentIndex, doneKeys);
        const isSkipped = state === 'done' && skippedKeys?.includes(step.key);
        const stateLabel =
          state === 'current'
            ? 'etapa actual'
            : isSkipped
              ? 'omitida'
              : state === 'done'
                ? 'completada'
                : 'pendiente';

        // El paso ACTUAL muestra su numero (handoff § Stepper: "numero --text 13/700"), igual
        // que los pendientes. Antes quedaba vacio y el circulo actual se leia como un hueco.
        const nodeContent = isSkipped ? '×' : state === 'done' ? '✓' : String(index + 1);

        const node = (
          <span
            className={cn(styles.node, {
              [styles.nodeDone]: state === 'done' && !isSkipped,
              [styles.nodeSkipped]: !!isSkipped,
              [styles.nodeCurrent]: state === 'current',
              [styles.nodePending]: state === 'pending',
            })}
            aria-hidden="true"
          >
            {nodeContent}
          </span>
        );

        return (
          <li
            key={step.key}
            className={styles.item}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {index > 0 && (
              <span
                className={cn(styles.connector, {
                  [styles.connectorDone]: state === 'done' || state === 'current',
                })}
                aria-hidden="true"
              />
            )}
            {interactive ? (
              <button
                type="button"
                className={styles.stepButton}
                onClick={() => onStepChange?.(step.key)}
              >
                {node}
                <span className={styles.label}>{step.label}</span>
              </button>
            ) : (
              <>
                {node}
                <span className={styles.label}>{step.label}</span>
              </>
            )}
            <span className={styles.srOnly}>
              {step.label}, {stateLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
