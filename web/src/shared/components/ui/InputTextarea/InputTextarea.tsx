import React, { ChangeEvent } from 'react';
import styles from './InputTextarea.module.scss';

interface InputProps {
  readonly label: string;
  readonly code: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly error: boolean;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly testId?: string;
}

export function InputTextarea(props: InputProps) {
  const {
    label,
    code,
    value,
    onChange,
    error,
    required,
    placeholder = '',
    disabled = false,
    testId,
  } = props;

  const changeValue = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={styles.container}>
      <label htmlFor="name">{label.toUpperCase()}</label>
      <textarea
        id={`input-${code}`}
        name={code}
        value={value}
        onChange={changeValue}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        style={{ border: error ? '1px solid #FB033F' : '' }}
      />
    </div>
  );
}
