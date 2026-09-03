'use client';
import 'react-datepicker/dist/react-datepicker.css';
import React, { useRef, useState } from 'react';
import Image from 'next/image';
import DatePicker from 'react-datepicker';
import ReactDOM from 'react-dom';
import { toast } from 'react-toastify';
import { useUpdateObjective } from '@/features/objectives';
import { Tooltip } from '@/shared/components/ui/Tooltip';
import { calculateDaysLeft, formatDate } from '@/shared/utils';
import calendarCloseToDeadLine from '@root/assets/calendar-close-to-dead-line.svg';
import calendarExpired from '@root/assets/calendar-expired.svg';
import calendarFinished from '@root/assets/calendar-finished.svg';
import calendar from '@root/assets/calendar.svg';
import styles from './FinishDateLabel.module.scss';
import type { UpdateObjectivePayload } from '@/features/objectives/types';
import type { Person } from '@/shared/types';

interface FinishDateLabelProps {
  readonly title: string;
  readonly state: string;
  readonly objectiveId: number;
  readonly priority: number;
  readonly estimatedFinishDate?: Date | null;
  readonly finishedAt?: Date | null;
  readonly area: string;
  readonly persons: Person[];
  readonly description?: string | null;
  readonly cardClass: 'closeToDeadline' | 'expired' | 'finished' | 'default' | 'expiresToday';
  readonly portalContainer: HTMLDivElement | null;
}

export function FinishDateLabel(props: FinishDateLabelProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState({ left: 0, top: 0 });
  const dateLabelRef = useRef<HTMLDivElement>(null);
  const {
    state,
    objectiveId,
    title,
    priority,
    area,
    persons,
    cardClass,
    estimatedFinishDate,
    finishedAt,
    portalContainer,
    description,
  } = props;
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    finishedAt ? new Date(finishedAt) : (estimatedFinishDate ?? null)
  );
  const personIds = persons.map((person) => person.id);
  const { mutate: updateObjective } = useUpdateObjective();

  const getStatusMessage = (): string => {
    if (finishedAt) {
      return 'Cerrado hace';
    }

    if (!selectedDate) {
      return 'Cierre estimado';
    }

    switch (cardClass) {
      case 'expired':
        return 'VENCIDO HACE';
      case 'closeToDeadline':
        return 'CIERRA EN';
      case 'default':
        return 'Cierra en';
      case 'expiresToday':
        return 'VENCE';
      default:
        return 'Cierra en';
    }
  };

  const getDaysLeft = (): string => {
    if (!selectedDate) {
      return 'N/D';
    }
    if (getStatusMessage() === 'VENCE') {
      return 'HOY';
    }
    const daysLeft = calculateDaysLeft(selectedDate);
    return daysLeft > 0 ? `${daysLeft} días` : `${Math.abs(daysLeft)} días`;
  };

  const getCalendarIcon = () => {
    switch (cardClass) {
      case 'closeToDeadline':
        return calendarCloseToDeadLine;
      case 'expired':
        return calendarExpired;
      case 'finished':
        return calendarFinished;
      case 'expiresToday':
        return calendarCloseToDeadLine;
      default:
        return calendar;
    }
  };

  const handleDateChange = (date: Date | null) => {
    const payload: UpdateObjectivePayload = {
      area,
      personIds,
      priority,
      state,
      title,
    };
    if (date) {
      payload.estimatedFinishDate = date.toISOString();
    }
    if (description) {
      payload.description = description;
    }
    updateObjective(
      { id: objectiveId, payload },
      {
        onSuccess: () => {
          setSelectedDate(date);
          setIsDatePickerOpen(false);
          toast.success('Se cambió la fecha de finalización de la tarea');
        },
        onError: () => toast.error('Hubo un error al cambiar la fecha de finalización'),
      }
    );
  };

  const handleDivClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (dateLabelRef.current) {
      const rect = dateLabelRef.current.getBoundingClientRect();
      const parentRect = portalContainer?.getBoundingClientRect();
      const datePickerWidth = 304;

      let top = rect.bottom + window.scrollY;
      let left = rect.left + rect.width / 2 - datePickerWidth / 2 + window.scrollX;

      if (parentRect) {
        top = rect.bottom - parentRect.top;
        left = rect.left + rect.width / 2 - datePickerWidth / 2 - parentRect.left;
      }

      setDatePickerPosition({
        left,
        top,
      });

      setIsDatePickerOpen(true);
    }
  };

  const dateLabel = (
    <div
      ref={dateLabelRef}
      className={styles.dateLabel}
      data-state={cardClass}
      onClick={handleDivClick}
    >
      <p>{getStatusMessage()}</p>
      <span>
        <Image src={getCalendarIcon()} alt="calendar icon" width={20} height={30} />
        {getDaysLeft()}
      </span>
      {isDatePickerOpen && portalContainer !== null
        ? (ReactDOM.createPortal(
            <div
              className={styles.datePicker}
              style={{
                left: datePickerPosition.left,
                position: 'absolute',
                top: datePickerPosition.top,
              }}
            >
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                onClickOutside={() => setIsDatePickerOpen(false)}
                inline
              />
            </div>,
            portalContainer
          ) as React.ReactNode)
        : null}
    </div>
  );

  if (isDatePickerOpen) {
    return dateLabel;
  }

  return (
    <Tooltip content={`Fecha de cierre: ${formatDate(selectedDate)}`}>{dateLabel}</Tooltip>
  );
}
