import React from 'react';
import Image from 'next/image';
import { Tooltip } from '@/shared/components/ui/Tooltip';
import { formatDate } from '@/shared/utils';
import calendarExpired from '@root/assets/calendar-expired.svg';
import calendar from '@root/assets/calendar.svg';
import styles from './DateLabel.module.scss';

interface DateLabelProps {
  /**
   * Acepta `string` además de `Date`: la api serializa las fechas y los tipos de dominio de
   * `web`, escritos a mano, las declaran `Date`. Ver `formatDate`.
   */
  readonly date?: Date | string;
  readonly label: string;
  readonly cardClass: 'closeToDeadline' | 'expired' | 'finished' | 'default' | 'expiresToday';
}

export function DateLabel(props: DateLabelProps) {
  const { date, label, cardClass } = props;

  const parsedDate = date === undefined ? undefined : date instanceof Date ? date : new Date(date);
  const isValidDate = parsedDate !== undefined && !isNaN(parsedDate.getTime());

  const calculateDaysPassed = (): number => {
    if (!isValidDate) {
      return 0;
    }
    const currentDate = new Date();
    const timeDifference = currentDate.getTime() - parsedDate.getTime();
    return Math.floor(timeDifference / (1000 * 3600 * 24));
  };

  const getDaysMessage = (): string => {
    if (!isValidDate) {
      return 'N/D';
    }
    const daysLeft = calculateDaysPassed();

    if (daysLeft > 0) {
      return `${daysLeft} días`;
    } else if (daysLeft < 0) {
      return `${Math.abs(daysLeft)} días`;
    }
    return 'Hoy';
  };

  const getCalendarIcon = () => {
    return cardClass === 'expired' ? calendarExpired : calendar;
  };

  return (
    <Tooltip content={formatDate(parsedDate)}>
      <div className={styles.dateLabel}>
        <p>{label}</p>
        <span>
          <Image src={getCalendarIcon()} alt="calendar icon" width={20} height={30} />
          {getDaysMessage()}
        </span>
      </div>
    </Tooltip>
  );
}
