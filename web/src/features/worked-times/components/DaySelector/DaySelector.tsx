'use client';

import { useMemo } from 'react';
import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';

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

// El semáforo de cada día no se comunica sólo con color: cada estado suma un símbolo
// y una palabra al label del chip, visible en el texto además del tinte del token.
const STATUS_MARK: Record<DayStatus, string> = {
  completed: '●',
  partial: '◐',
  empty: '○',
};

const STATUS_LABEL: Record<DayStatus, string> = {
  completed: 'completo',
  partial: 'parcial',
  empty: 'sin carga',
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

  const options = days.map((day) => {
    const status = getDayStatus(dailyMinutes[day.date], completedThreshold);
    return {
      value: day.date,
      label: `${day.label} ${STATUS_MARK[status]} ${STATUS_LABEL[status]}`,
    };
  });

  return (
    <ToggleGroup
      variant="day-chip"
      label="Elegir día a cargar"
      options={options}
      value={selectedDate}
      onChange={onDayChange}
    />
  );
}
