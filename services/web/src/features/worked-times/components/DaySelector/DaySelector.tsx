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

// El semáforo de cada día es un PUNTO DE COLOR debajo del label, como en el diseño anterior:
// verde carga completa, ámbar carga parcial, grafito sin carga.
//
// Antes de esto el estado viajaba dentro del texto del label («Vie 4 ○ sin carga»), que era la
// forma de no comunicarlo sólo por color pero convertía cada chip en una frase. El punto vuelve
// a ser gráfico y la accesibilidad la cubre `statusLabel`, que va en un texto sr-only.
const STATUS_LABEL: Record<DayStatus, string> = {
  completed: 'carga completa',
  partial: 'carga parcial',
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
      label: day.label,
      status,
      statusLabel: STATUS_LABEL[status],
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
