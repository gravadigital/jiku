'use client';

import React, { useCallback, useState } from 'react';
import { Button } from '@/shared/components/ui/Button';
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

const PERIOD_OPTIONS: Array<{ key: PeriodOption; label: string }> = [
  { key: 'this-week', label: 'Esta semana' },
  { key: 'last-week', label: 'Semana pasada' },
  { key: 'this-month', label: 'Este mes' },
  { key: 'last-month', label: 'Mes pasado' },
  { key: 'custom', label: 'Rango personalizado' },
];

export function PeriodFilter({ dateFrom, dateTo, onPeriodChange }: PeriodFilterProps) {
  const [activePeriod, setActivePeriod] = useState<PeriodOption>('this-week');
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  const handlePeriodClick = useCallback(
    (period: PeriodOption) => {
      setActivePeriod(period);

      let range: { dateFrom: string; dateTo: string };
      switch (period) {
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCustomFrom(value);
      if (value && customTo) {
        onPeriodChange(value, customTo);
      }
    },
    [customTo, onPeriodChange]
  );

  const handleCustomToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setCustomTo(value);
      if (customFrom && value) {
        onPeriodChange(customFrom, value);
      }
    },
    [customFrom, onPeriodChange]
  );

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        {PERIOD_OPTIONS.map((option) => (
          <Button
            key={option.key}
            variant={activePeriod === option.key ? 'primary' : 'secondary-dismiss'}
            onClick={() => handlePeriodClick(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {activePeriod === 'custom' && (
        <div className={styles.customRange}>
          <div className={styles.dateField}>
            <label className={styles.dateLabel} htmlFor="report-date-from">
              DESDE
            </label>
            <input
              id="report-date-from"
              type="date"
              className={styles.dateInput}
              value={customFrom}
              onChange={handleCustomFromChange}
            />
          </div>
          <div className={styles.dateField}>
            <label className={styles.dateLabel} htmlFor="report-date-to">
              HASTA
            </label>
            <input
              id="report-date-to"
              type="date"
              className={styles.dateInput}
              value={customTo}
              onChange={handleCustomToChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
