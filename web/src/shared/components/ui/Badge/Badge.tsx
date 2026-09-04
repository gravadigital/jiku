'use client';
import React, { useState } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Badge.module.scss';

export type BadgeGlyph = 'square' | 'round';

export type BadgeVariant = 'state' | 'outline' | 'area' | 'editable' | 'card-tag';

/**
 * Familia de color de sistema. El componente recibe la familia, no el estado de
 * dominio — el mapeo estado→familia vive fuera de `Badge` (ver `STATE_TO_FAMILY`).
 */
export type BadgeFamily =
  | 'resolved'
  | 'in-progress'
  | 'review'
  | 'urgent'
  | 'analysis'
  | 'neutral';

export interface BadgeOption {
  readonly value: string;
  readonly label: string;
}

type BadgePresentationalVariant = Exclude<BadgeVariant, 'editable'>;

interface BadgePresentationalProps {
  readonly variant?: BadgePresentationalVariant;
  readonly family?: BadgeFamily;
  readonly label: string;
  /** Forma del glifo. Sólo aplica a `card-tag`: cuadrado el tipo, círculo la prioridad. */
  readonly glyph?: BadgeGlyph;
}

interface BadgeEditableProps {
  readonly variant: 'editable';
  readonly family?: BadgeFamily;
  readonly label: string;
  readonly options: BadgeOption[];
  readonly onChange: (value: string) => void;
}

type BadgeProps = BadgePresentationalProps | BadgeEditableProps;

/**
 * Mapeo estado de dominio -> familia de color del spec. Tabla del spec `Badge` v1.1.0
 * (sección "Mapeo de estado a familia de color"), exportada para que las stories de
 * pantalla (S-056 a S-058) la consuman sin reimplementarla.
 */
export const STATE_TO_FAMILY: Record<string, BadgeFamily> = {
  planificacion: 'analysis',
  en_cola: 'neutral',
  desarrollo: 'in-progress',
  revision: 'review',
  resuelto: 'resolved',
  cancelado: 'neutral',
};

// Glifo de la etiqueta de card (handoff § Badges y pills): es una FORMA, no un color de
// estado. El tipo de proyecto va en cuadrado con borde y la prioridad en circulo lleno.
//
// La forma la declara quien construye la etiqueta y NO se deduce de la familia: "Prioridad 0"
// es family `neutral`, igual que "Interno", y sin embargo lleva circulo. Decorativo: la
// etiqueta ya lleva su texto al lado.
function CardTagGlyph({ shape }: { readonly shape: BadgeGlyph }) {
  return (
    <span
      className={cn(styles.tagGlyph, { [styles.tagGlyphRound]: shape === 'round' })}
      aria-hidden="true"
    />
  );
}

const FAMILY_CLASS: Record<BadgeFamily, string> = {
  resolved: styles.familyResolved,
  'in-progress': styles.familyInProgress,
  review: styles.familyReview,
  urgent: styles.familyUrgent,
  analysis: styles.familyAnalysis,
  neutral: styles.familyNeutral,
};

function AreaGlyph() {
  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      className={styles.chevron}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function Badge(props: BadgeProps) {
  const { variant = 'state', family = 'neutral', label } = props;
  const glyph = 'glyph' in props ? props.glyph : undefined;
  const [open, setOpen] = useState(false);

  const familyClass = FAMILY_CLASS[family];

  if (variant === 'editable') {
    const { options, onChange } = props as BadgeEditableProps;

    const handleSelect = (value: string) => {
      onChange(value);
      setOpen(false);
    };

    return (
      <span className={styles.wrapper}>
        <button
          type="button"
          className={cn(styles.badge, styles.editable, familyClass)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Estado: ${label}`}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.text}>{label}</span>
          <ChevronDown />
        </button>
        {open && (
          <ul role="listbox" className={styles.menu}>
            {options.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.label === label}
                className={styles.option}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(styles.badge, familyClass, {
        [styles.outline]: variant === 'outline',
        [styles.area]: variant === 'area',
        [styles.cardTag]: variant === 'card-tag',
      })}
    >
      {variant === 'area' && <AreaGlyph />}
      {variant === 'card-tag' && glyph && <CardTagGlyph shape={glyph} />}
      {variant !== 'outline' && variant !== 'area' && variant !== 'card-tag' && (
        <span className={styles.dot} aria-hidden="true" />
      )}
      <span className={styles.text}>{label}</span>
    </span>
  );
}
