import React, { ChangeEvent } from 'react';
import { labelFromDate } from '@/shared/utils';
import styles from './DatePicker.module.scss';

interface InputProps {
  readonly label: string;
  readonly code: string;
  readonly value?: Date | string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly error: boolean;
}

export function DatePicker(props: InputProps) {
  const { label, code, value, onChange, error, required = false } = props;
  let formatedDate = '';

  if (value) {
    const date = new Date(value);
    formatedDate = labelFromDate(date, 'YYYY-MM-DD');
  }

  const changeValue = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.value) {
      onChange('');
      return;
    }
    const [year, month, day] = event.target.value.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    onChange(localDate.toISOString());
  };

  return (
    <div className={styles.container}>
      <label htmlFor="name">{label.toUpperCase()}</label>
      <input
        type="date"
        id={`input-${code}`}
        name={code}
        value={formatedDate}
        onChange={changeValue}
        required={required}
        style={{ border: error ? '1px solid red' : '' }}
      />
    </div>
  );
}
