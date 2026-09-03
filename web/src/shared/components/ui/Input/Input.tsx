'use client';
import React, { ChangeEvent, useId } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Input.module.scss';

type InputVariant = 'text' | 'textarea' | 'date' | 'search' | 'locked';

interface InputProps {
  readonly variant?: InputVariant;
  /** Label visible, requerido: el placeholder no lo reemplaza. */
  readonly label: string;
  readonly required?: boolean;
  readonly placeholder?: string;
  /** Mensaje de error; su sola presencia activa el state `error`. */
  readonly error?: string;
  readonly disabled?: boolean;
  /** Nombre del icono del set (no usado por las variantes `date`/`search`, que traen el suyo). */
  readonly icon?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

function CalendarIcon() {
  return (
    <svg
      className={styles.iconSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className={styles.iconSvg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function Input(props: InputProps) {
  const {
    variant = 'text',
    label,
    required = false,
    placeholder,
    error,
    disabled = false,
    icon,
    value,
    onChange,
  } = props;

  const inputId = useId();
  const errorId = useId();
  const isLocked = variant === 'locked';
  const isTextarea = variant === 'textarea';
  const hasError = Boolean(error);
  const resolvedPlaceholder =
    variant === 'date' ? 'mm/dd/aaaa' : (placeholder ?? undefined);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const leadingIcon =
    variant === 'date' ? <CalendarIcon /> : variant === 'search' ? <SearchIcon /> : null;

  const fieldClassName = cn(styles.field, {
    [styles.error]: hasError,
    [styles.locked]: isLocked,
    [styles.withIcon]: Boolean(leadingIcon || icon),
  });

  return (
    <div className={styles.container}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className={styles.fieldWrapper}>
        {leadingIcon && <span className={styles.iconLeading}>{leadingIcon}</span>}
        {isTextarea ? (
          <textarea
            id={inputId}
            className={fieldClassName}
            value={value}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            readOnly={isLocked}
            required={required}
            aria-required={required || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            onChange={handleChange}
          />
        ) : (
          <input
            id={inputId}
            type="text"
            className={fieldClassName}
            value={value}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            readOnly={isLocked}
            required={required}
            aria-required={required || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            onChange={handleChange}
          />
        )}
      </div>
      {hasError && (
        <p id={errorId} className={styles.errorMessage}>
          <span aria-hidden="true">!</span> {error}
        </p>
      )}
    </div>
  );
}
