import React from 'react';
import Image from 'next/image';
import { Tooltip } from '@/shared/components/ui/Tooltip';
import { formatDate } from '@/shared/utils';
import calendarExpired from '@root/assets/calendar-expired.svg';
import calendar from '@root/assets/calendar.svg';
import styles from './DateLabel.module.scss';

interface DateLabelProps {
  readonly date?: Date;
  readonly label: string;
  readonly cardClass: 'closeToDeadline' | 'expired' | 'finished' | 'default' | 'expiresToday';
}

export function DateLabel(props: DateLabelProps) {
  const { date, label, cardClass } = props;

  const calculateDaysPassed = (): number => {
    if (!date) {
      return 0;
    }
    const currentDate = new Date();
    const timeDifference = currentDate.getTime() - date.getTime();
    return Math.floor(timeDifference / (1000 * 3600 * 24));
  };

  const getDaysMessage = (): string => {
    if (!date) {
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
    <Tooltip message={formatDate(date)}>
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
