'use client';

import { useHoursPerDay } from '@/features/time-allocation/hooks/useHoursPerDay';
import { Button } from '@/shared/components/ui/Button';
import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';
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

  const hourOptions = Array.from({ length: maxHours + 1 }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));

  const minuteOptions = MINUTE_OPTIONS.map((m) => ({ value: String(m), label: String(m) }));

  const totalMinutes = selectedHours * 60 + selectedMinutes;
  const displayHours = Math.floor(totalMinutes / 60);
  const displayMinutes = totalMinutes % 60;

  const handleHoursChange = (value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onHoursChange(parsed);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <ToggleGroup
          variant="stepper-value"
          label="Horas"
          options={hourOptions}
          value={String(selectedHours)}
          onChange={handleHoursChange}
          allowOther
        />
      </div>

      <div className={styles.section}>
        <ToggleGroup
          variant="stepper-value"
          label="Minutos"
          options={minuteOptions}
          value={String(selectedMinutes)}
          onChange={(value) => onMinutesChange(parseInt(value, 10) || 0)}
        />
      </div>

      <div className={styles.footer}>
        <span className={styles.total}>
          Total seleccionado: {displayHours}h {displayMinutes}min
        </span>
        <Button onClick={onSubmit} disabled={!canSubmit} loading={isSubmitting}>
          Cargar horas
        </Button>
      </div>
    </div>
  );
}
