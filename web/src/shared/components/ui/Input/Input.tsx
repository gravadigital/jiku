import React, { ChangeEvent } from 'react';
import styles from './Input.module.scss';

interface InputProps {
  readonly label: string;
  readonly code: string;
  readonly value: string;
  readonly onChange: (text: string) => void;
  readonly required?: boolean;
  readonly error?: boolean;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

export function Input(props: InputProps) {
  const {
    label,
    code,
    value,
    onChange,
    error,
    required = false,
    placeholder,
    disabled = false,
  } = props;
  const changeValue = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const inputId = `input-${code}`;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.container}>
      <label htmlFor={inputId}>{label.toUpperCase()}</label>
      <input
        type="text"
        id={inputId}
        name={code}
        value={value}
        onChange={changeValue}
        required={required}
        aria-required={required}
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        style={{ border: error ? '1px solid #FB033F' : '' }}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
