'use client';
import React, { ChangeEvent, useId } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Input.module.scss';

type InputVariant = 'text' | 'textarea' | 'date' | 'search' | 'locked';

interface InputProps {
  readonly variant?: InputVariant;
  /** Label visible, requerido: el placeholder no lo reemplaza. */
  readonly label: string;
  /**
   * Oculta visualmente el label sin quitarlo del nombre accesible (S-058). Pensado para
   * grillas densas de celdas repetidas (una tabla `matrix` con un campo por celda) donde
   * el label visible de cada celda repetiría el contexto que la fila y la columna ya dan
   * — el label sigue siendo obligatorio, sólo cambia si se pinta en pantalla.
   */
  readonly hideLabel?: boolean;
  /**
   * Reemplaza el `<label>` visible por un nombre accesible en el propio campo. Para cuando el
   * contexto ya nombra al campo en pantalla (la cabecera de un acordeón, por ejemplo) y un
   * label —aunque esté oculto— duplicaría ese texto en el DOM. Es el mismo recurso que usa
   * `MarkdownEditorWithPreview`. Excluyente con el label visible: si se pasa, no se renderiza
   * el `<label>`.
   */
  readonly ariaLabel?: string;
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
    hideLabel = false,
    ariaLabel,
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
  // `date` no lleva placeholder: con `type="date"` el navegador dibuja su propia máscara de
  // formato y un placeholder propio quedaría encima, además de mentir sobre el orden de los
  // campos (que lo decide el locale del sistema, no el DS).
  const resolvedPlaceholder = variant === 'date' ? undefined : (placeholder ?? undefined);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  // `date` NO lleva icono propio: `type="date"` ya dibuja el indicador de calendario del
  // navegador, y ése es el control que abre el selector. Sumarle el nuestro dejaba dos
  // calendarios en el mismo campo, y el clickeable era sólo uno de los dos.
  const leadingIcon = variant === 'search' ? <SearchIcon /> : null;

  const fieldClassName = cn(styles.field, {
    [styles.error]: hasError,
    [styles.locked]: isLocked,
    [styles.withIcon]: Boolean(leadingIcon || icon),
  });

  return (
    <div className={styles.container}>
      {!ariaLabel && (
        <label htmlFor={inputId} className={cn(styles.label, { [styles.labelHidden]: hideLabel })}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
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
            aria-label={ariaLabel}
            aria-required={required || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            onChange={handleChange}
          />
        ) : (
          <input
            id={inputId}
            type={variant === 'date' ? 'date' : 'text'}
            className={fieldClassName}
            value={value}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            readOnly={isLocked}
            required={required}
            aria-label={ariaLabel}
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
