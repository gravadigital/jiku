'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/shared/utils';
import styles from './EditableCell.module.scss';

interface EditableCellProps {
  readonly personId: number;
  readonly projectId: number;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly hoursPerDay: number;
  readonly isOverallocated?: boolean;
}

export function EditableCell(props: EditableCellProps) {
  const { value, onChange, isOverallocated = false } = props;
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

  return (
    <td
      className={cn(styles.editableCell, {
        [styles.overallocated]: isOverallocated,
      })}
    >
      <input
        type="number"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        min="0"
        step="0.1"
        className={styles.input}
      />
    </td>
  );
}
