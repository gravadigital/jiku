'use client';
import React, { ChangeEvent, useState } from 'react';
import { cn } from '@/shared/utils';
import styles from './InputText.module.scss';

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

export function InputText(props: InputProps) {
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
  const [touched, setTouched] = useState(false);
  const changeValue = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const showError = error || (required && touched && !value.trim());

  return (
    <div className={styles.container}>
      <label htmlFor="name">
        {label.toUpperCase()}
        {required && <span className={styles.requiredAsterisk}>*</span>}
      </label>
      <input
        type="text"
        id={`input-${code}`}
        name={code}
        value={value}
        onChange={changeValue}
        onBlur={() => setTouched(true)}
        required={required}
        className={cn(showError ? styles.inputError : '')}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
