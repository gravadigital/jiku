'use client';

import React from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './ToggleGroup.module.scss';

interface ToggleGroupOption<T extends string> {
  readonly key: T;
  readonly label: string;
}

interface ToggleGroupProps<T extends string> {
  readonly options: readonly ToggleGroupOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

export function ToggleGroup<T extends string>({ options, value, onChange }: ToggleGroupProps<T>) {
  return (
    <div className={styles.container}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={cn(styles.option, { [styles.active]: value === option.key })}
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
