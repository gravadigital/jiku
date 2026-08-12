'use client';

import { useMemo } from 'react';
import { cn } from '@/shared/utils';
import styles from './DaySelector.module.scss';

type DayStatus = 'completed' | 'partial' | 'empty';

interface DaySelectorProps {
  readonly selectedDate: string;
  readonly onDayChange: (date: string) => void;
  readonly dailyMinutes?: Record<string, number>;
  readonly completedThreshold?: number;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDayStatus = (minutes: number | undefined, threshold: number): DayStatus => {
  if (!minutes || minutes === 0) return 'empty';
  if (minutes >= threshold) return 'completed';
  return 'partial';
};

export function DaySelector({
  selectedDate,
  onDayChange,
  dailyMinutes = {},
  completedThreshold = 360,
}: DaySelectorProps) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allDays = [];
    let daysBack = 0;
    while (allDays.length < 8) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysBack);
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        allDays.unshift({
          date: formatDate(d),
          label: `${DAY_NAMES[dayOfWeek]} ${d.getDate()}`,
          isToday: daysBack === 0,
        });
      }
      daysBack++;
    }
    return allDays;
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.days}>
        {days.map((day) => {
          const status = getDayStatus(dailyMinutes[day.date], completedThreshold);
          return (
            <button
              key={day.date}
              type="button"
              className={cn(styles.dayButton, {
                [styles.selected]: day.date === selectedDate,
                [styles.today]: day.isToday,
              })}
              onClick={() => onDayChange(day.date)}
              aria-pressed={day.date === selectedDate}
              aria-current={day.isToday ? 'date' : undefined}
            >
              {day.label}
              <span className={cn(styles.dot, styles[status])} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
