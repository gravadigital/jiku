'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '@/shared/components/ui/Input';
import styles from './EditableCell.module.scss';

interface EditableCellProps {
  readonly personId: number;
  readonly projectId: number;
  /** Nombre completo de la persona, para el nombre accesible del campo (TS-95). */
  readonly personName: string;
  /** Nombre del proyecto, para el nombre accesible del campo (TS-95). */
  readonly projectName: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly hoursPerDay: number;
  readonly isOverallocated?: boolean;
}

export function EditableCell(props: EditableCellProps) {
  const { personName, projectName, value, onChange, hoursPerDay, isOverallocated = false } = props;
  const [inputValue, setInputValue] = useState(value.toString());

  // Sync inputValue with value prop when it changes
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleChange = (newValue: string) => {
    setInputValue(newValue);
    const numValue = parseFloat(newValue) || 0;
    onChange(numValue);
  };

  const hours = (parseFloat(inputValue) / 100 || 0) * hoursPerDay * 5;
  const hoursLabel = hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;

  return (
    <span className={isOverallocated ? styles.overallocated : undefined}>
      <Input
        variant="text"
        label={`Porcentaje de capacidad de ${personName} en ${projectName}`}
        hideLabel
        value={inputValue}
        onChange={handleChange}
      />
      <span className={styles.hours}>{hoursLabel}</span>
    </span>
  );
}
