'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { Input } from '../Input';
import styles from './ToggleGroup.module.scss';

type ToggleGroupVariant = 'segmented' | 'range-pill' | 'stepper-value' | 'day-chip';

interface ToggleGroupOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

interface ToggleGroupProps {
  readonly variant?: ToggleGroupVariant;
  /** Nombre accesible del grupo, requerido. */
  readonly label: string;
  readonly options: readonly ToggleGroupOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Solo tiene efecto en `stepper-value`: habilita la opción «Otro». */
  readonly allowOther?: boolean;
}

const VARIANT_CLASS: Record<ToggleGroupVariant, string> = {
  segmented: styles.segmented,
  'range-pill': styles.rangePill,
  'stepper-value': styles.stepperValue,
  'day-chip': styles.dayChip,
};

const OTHER_VALUE = '__other__';

export function ToggleGroup({
  variant = 'segmented',
  label,
  options,
  value,
  onChange,
  allowOther = false,
}: ToggleGroupProps) {
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const showOther = allowOther && variant === 'stepper-value';
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherValue, setOtherValue] = useState('');

  const allOptions: readonly ToggleGroupOption[] = showOther
    ? [...options, { value: OTHER_VALUE, label: 'Otro' }]
    : options;

  const activeValue = otherSelected ? OTHER_VALUE : value;

  const focusItemAt = (index: number) => {
    const option = allOptions[index];
    if (!option) return;
    itemRefs.current[option.value]?.focus();
  };

  const selectOption = (option: ToggleGroupOption) => {
    if (option.disabled) return;
    if (showOther && option.value === OTHER_VALUE) {
      setOtherSelected(true);
      return;
    }
    setOtherSelected(false);
    onChange(option.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (index + 1) % allOptions.length;
      focusItemAt(next);
      selectOption(allOptions[next]);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (index - 1 + allOptions.length) % allOptions.length;
      focusItemAt(prev);
      selectOption(allOptions[prev]);
    }
  };

  const radioGroup = (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(styles.container, VARIANT_CLASS[variant])}
    >
      {allOptions.map((option, index) => {
        const isActive = option.value === activeValue;
        return (
          <button
            key={option.value}
            ref={(el) => {
              itemRefs.current[option.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={option.disabled}
            tabIndex={isActive ? 0 : -1}
            className={cn(styles.option, { [styles.active]: isActive })}
            onClick={() => selectOption(option)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  // El wrapper extra solo existe cuando puede aparecer el input de «Otro»: en
  // el resto de los usos el radiogroup queda como raíz, sin un nivel de DOM
  // adicional que los consumidores existentes (ReportPage, WorkedTimesPage,
  // MarkdownEditorWithPreview) no esperan.
  if (!showOther) {
    return radioGroup;
  }

  return (
    <div className={styles.wrapper}>
      {radioGroup}
      {otherSelected && (
        <Input
          label={`${label}: valor libre`}
          value={otherValue}
          onChange={(next) => {
            setOtherValue(next);
            onChange(next);
          }}
        />
      )}
    </div>
  );
}
