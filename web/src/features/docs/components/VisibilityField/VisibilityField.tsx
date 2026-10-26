'use client';

import React, { useId } from 'react';
import { ToggleGroup } from '@/shared/components/ui';
import { visibilityLabel } from '../../utils/documentLabels';
import styles from './VisibilityField.module.scss';
import type { DocsVisibility } from '../../types/docs.types';

const HELP: Record<DocsVisibility, string> = {
  internal: 'Solo el equipo.',
  public: 'Llega al portal del cliente del proyecto.',
  restricted: 'Solo la conducción. No se puede compartir.',
};

const RESTRICT_WARNING = 'Al guardar, los links compartidos de este documento dejan de funcionar.';

interface VisibilityFieldProps {
  readonly value: DocsVisibility;
  readonly onChange: (value: DocsVisibility) => void;
  /** Ayuda de interfaz: la autoridad es jiku-docs (`permission_denied`). */
  readonly canRestrict: boolean;
  readonly initialValue?: DocsVisibility;
  /** En edición: avisa que pasar a "Restringido" revoca los links. */
  readonly warnOnRestrict?: boolean;
  readonly error?: string;
}

export function VisibilityField({
  value,
  onChange,
  canRestrict,
  initialValue,
  warnOnRestrict = false,
  error,
}: VisibilityFieldProps) {
  const baseId = useId();
  const helpId = `${baseId}-help`;
  const warnId = `${baseId}-warn`;
  const errorId = `${baseId}-error`;

  // Un `user` que abre un documento ya restringido lo ve marcado, sin poder cambiarlo.
  const lockedByRole = !canRestrict && value === 'restricted';
  const showRestricted = canRestrict || value === 'restricted';
  const showWarning = warnOnRestrict && value === 'restricted' && initialValue !== 'restricted';

  const options = (
    ['internal', 'public', ...(showRestricted ? ['restricted'] : [])] as DocsVisibility[]
  ).map((v) => ({ value: v, label: visibilityLabel(v), disabled: lockedByRole }));

  const describedBy = [helpId, showWarning ? warnId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.root}>
      <span className={styles.label}>Visibilidad</span>
      <ToggleGroup
        variant="segmented"
        label="Visibilidad"
        options={options}
        value={value}
        onChange={(next) => onChange(next as DocsVisibility)}
        ariaDescribedBy={describedBy}
      />
      <p id={helpId} className={styles.help}>
        {HELP[value]}
      </p>
      {showWarning && (
        <p id={warnId} className={styles.help}>
          {RESTRICT_WARNING}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
