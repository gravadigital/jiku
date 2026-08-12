'use client';

import React, { useState } from 'react';
import { useHoursPerDay } from '@/features/time-allocation/hooks/useHoursPerDay';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/utils';
import styles from './TimeButtons.module.scss';

interface TimeButtonsProps {
  readonly selectedHours: number;
  readonly selectedMinutes: number;
  readonly onHoursChange: (hours: number) => void;
  readonly onMinutesChange: (minutes: number) => void;
  readonly onSubmit: () => void;
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
}

const MINUTE_OPTIONS = [0, 10, 20, 30, 40, 50];

export function TimeButtons({
  selectedHours,
  selectedMinutes,
  onHoursChange,
  onMinutesChange,
  onSubmit,
  canSubmit,
  isSubmitting,
}: TimeButtonsProps) {
  const { data: hoursPerDayData } = useHoursPerDay();
  const maxHours = hoursPerDayData?.hoursPerDay ?? 6;
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const hourOptions = Array.from({ length: maxHours + 1 }, (_, i) => i);
  const isCustom = selectedHours > maxHours;

  const handleCustomConfirm = () => {
    const value = parseInt(customValue, 10);
    if (!isNaN(value) && value >= 0) {
      onHoursChange(value);
      setShowCustomInput(false);
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomConfirm();
    }
  };

  const totalMinutes = selectedHours * 60 + selectedMinutes;
  const displayHours = Math.floor(totalMinutes / 60);
  const displayMinutes = totalMinutes % 60;

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <span className={styles.label}>Horas:</span>
        <div className={styles.buttons}>
          {hourOptions.map((h) => (
            <button
              key={h}
              type="button"
              className={cn(styles.timeButton, {
                [styles.selected]: selectedHours === h && !isCustom,
              })}
              onClick={() => {
                onHoursChange(h);
                setShowCustomInput(false);
              }}
              aria-pressed={selectedHours === h && !isCustom}
            >
              {h}
            </button>
          ))}
          <button
            type="button"
            className={cn(styles.timeButton, {
              [styles.selected]: isCustom || showCustomInput,
            })}
            onClick={() => setShowCustomInput(true)}
            aria-pressed={isCustom}
          >
            Otro
          </button>
        </div>
        {showCustomInput && (
          <div className={styles.customInput}>
            <input
              type="number"
              min="0"
              max="24"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              onBlur={handleCustomConfirm}
              placeholder="Horas"
              className={styles.input}
              autoFocus
            />
          </div>
        )}
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Minutos:</span>
        <div className={styles.buttons}>
          {MINUTE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className={cn(styles.timeButton, {
                [styles.selected]: selectedMinutes === m,
              })}
              onClick={() => onMinutesChange(m)}
              aria-pressed={selectedMinutes === m}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.total}>
          Total seleccionado: {displayHours}h {displayMinutes}min
        </span>
        <Button
          label="Cargar horas"
          onClick={onSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />
      </div>
    </div>
  );
}
