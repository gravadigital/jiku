'use client';

import React, { useCallback, useState } from 'react';
import { Input } from '@/shared/components/ui/Input';
import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';
import styles from './PeriodFilter.module.scss';

type PeriodOption = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

interface PeriodFilterProps {
  readonly dateFrom: string;
  readonly dateTo: string;
  readonly onPeriodChange: (dateFrom: string, dateTo: string) => void;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getThisWeekRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const monday = getMonday(today);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { dateFrom: formatDate(monday), dateTo: formatDate(sunday) };
}

function getLastWeekRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const monday = getMonday(today);
  monday.setDate(monday.getDate() - 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { dateFrom: formatDate(monday), dateTo: formatDate(sunday) };
}

function getThisMonthRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { dateFrom: formatDate(first), dateTo: formatDate(last) };
}

function getLastMonthRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const last = new Date(today.getFullYear(), today.getMonth(), 0);
  return { dateFrom: formatDate(first), dateTo: formatDate(last) };
}

const PERIOD_OPTIONS: Array<{ value: PeriodOption; label: string }> = [
  { value: 'this-week', label: 'Esta semana' },
  { value: 'last-week', label: 'Semana pasada' },
  { value: 'this-month', label: 'Este mes' },
  { value: 'last-month', label: 'Mes pasado' },
  { value: 'custom', label: 'Rango personalizado' },
];

export function PeriodFilter({ dateFrom, dateTo, onPeriodChange }: PeriodFilterProps) {
  const [activePeriod, setActivePeriod] = useState<PeriodOption>('this-week');
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  const handlePeriodClick = useCallback(
    (period: string) => {
      const typedPeriod = period as PeriodOption;
      setActivePeriod(typedPeriod);

      let range: { dateFrom: string; dateTo: string };
      switch (typedPeriod) {
        case 'this-week':
          range = getThisWeekRange();
          break;
        case 'last-week':
          range = getLastWeekRange();
          break;
        case 'this-month':
          range = getThisMonthRange();
          break;
        case 'last-month':
          range = getLastMonthRange();
          break;
        case 'custom':
          return;
        default:
          return;
      }

      onPeriodChange(range.dateFrom, range.dateTo);
    },
    [onPeriodChange]
  );

  const handleCustomFromChange = useCallback(
    (value: string) => {
      setCustomFrom(value);
      if (value && customTo) {
        onPeriodChange(value, customTo);
      }
    },
    [customTo, onPeriodChange]
  );

  const handleCustomToChange = useCallback(
    (value: string) => {
      setCustomTo(value);
      if (customFrom && value) {
        onPeriodChange(customFrom, value);
      }
    },
    [customFrom, onPeriodChange]
  );

  return (
    <div className={styles.container}>
      <ToggleGroup
        variant="range-pill"
        label="Período del reporte"
        options={PERIOD_OPTIONS}
        value={activePeriod}
        onChange={handlePeriodClick}
      />

      {activePeriod === 'custom' && (
        <div className={styles.customRange}>
          <Input
            variant="date"
            label="Desde"
            value={customFrom}
            onChange={handleCustomFromChange}
          />
          <Input variant="date" label="Hasta" value={customTo} onChange={handleCustomToChange} />
        </div>
      )}
    </div>
  );
}
