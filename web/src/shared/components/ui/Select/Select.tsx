'use client';
import React, { KeyboardEvent, useId, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Select.module.scss';

export type SelectVariant = 'single' | 'multiple' | 'locked' | 'inline';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectSingleProps {
  readonly variant?: Exclude<SelectVariant, 'multiple'>;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

interface SelectMultipleProps {
  readonly variant: 'multiple';
  readonly value: string[];
  readonly onChange: (value: string[]) => void;
}

type SelectProps = (SelectSingleProps | SelectMultipleProps) & {
  /** Requerido salvo en `inline`, donde el nombre accesible puede venir de otra parte. */
  readonly label?: string;
  readonly options: SelectOption[];
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly error?: string;
  readonly disabled?: boolean;
  /**
   * Agrega un buscador dentro del menú, que filtra las opciones por texto.
   *
   * Es opt-in y no el default: con pocas opciones un buscador estorba más de lo que ayuda.
   * Se activa cuando la lista es larga y no memorizable — el filtro por proyecto del listado
   * de requisitos tiene ~100 opciones, y sin buscador encontrar una es impracticable.
   */
  readonly searchable?: boolean;
};

function ChevronIcon({ open }: { readonly open: boolean }) {
  return (
    <svg
      className={cn(styles.chevron, { [styles.chevronOpen]: open })}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function Select(props: SelectProps) {
  const {
    variant = 'single',
    label,
    options,
    placeholder,
    required = false,
    error,
    disabled = false,
    searchable = false,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const controlRef = useRef<HTMLDivElement | HTMLButtonElement>(null);

  const controlId = useId();
  const listboxId = useId();
  const errorId = useId();
  const labelId = useId();

  const isMultiple = variant === 'multiple';
  const isLocked = variant === 'locked';
  const isInline = variant === 'inline';
  const hasError = Boolean(error);

  const selectedValues: string[] = isMultiple
    ? (props as SelectMultipleProps).value
    : (props as SelectSingleProps).value
      ? [(props as SelectSingleProps).value]
      : [];

  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));

  // La navegación por teclado y el commit operan sobre las opciones VISIBLES: si el índice
  // activo apuntara a `options` mientras el menú muestra una lista filtrada, Enter elegiría
  // una opción distinta de la resaltada.
  const normalize = (text: string) =>
    text
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const visibleOptions =
    searchable && query.trim()
      ? options.filter((option) => normalize(option.label).includes(normalize(query)))
      : options;

  const closeMenu = () => {
    setOpen(false);
    setActiveIndex(-1);
    setQuery('');
  };

  const openMenu = () => {
    if (disabled || isLocked) return;
    setOpen(true);
    setActiveIndex(0);
    // El foco pasa al buscador para poder tipear sin un salto de teclado extra. El control
    // sigue siendo el combobox: `aria-activedescendant` no cambia de dueño.
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  };

  const toggleMenu = () => {
    if (open) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const commitSingle = (value: string) => {
    (props as SelectSingleProps).onChange(value);
    closeMenu();
    controlRef.current?.focus();
  };

  const commitMultiple = (value: string) => {
    const current = (props as SelectMultipleProps).value;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    (props as SelectMultipleProps).onChange(next);
  };

  const selectOption = (value: string) => {
    if (isMultiple) {
      commitMultiple(value);
    } else {
      commitSingle(value);
    }
  };

  const removeChip = (value: string) => {
    const current = (props as SelectMultipleProps).value;
    (props as SelectMultipleProps).onChange(current.filter((v) => v !== value));
  };

  const handleControlKeyDown = (event: KeyboardEvent<HTMLDivElement | HTMLButtonElement>) => {
    if (disabled || isLocked) return;

    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      controlRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, visibleOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex >= 0 && visibleOptions[activeIndex]) {
        selectOption(visibleOptions[activeIndex].value);
      }
      return;
    }

    if (
      event.key === 'Backspace' &&
      isMultiple &&
      (props as SelectMultipleProps).value.length > 0
    ) {
      const current = (props as SelectMultipleProps).value;
      removeChip(current[current.length - 1]);
    }
  };

  const accessibleName = label ?? placeholder ?? '';

  return (
    <div className={styles.container}>
      {label && !isInline && (
        <label id={labelId} htmlFor={controlId} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      <div className={styles.controlWrapper}>
        {isMultiple ? (
          // Un <button> no puede contener contenido interactivo anidado (HTML inválido);
          // `multiple` renderiza chips con su propio botón de remoción, así que el control
          // usa un <div role="combobox"> en vez de <button>. El resto de variants no anida
          // controles y sí usa <button>, más simple y con semántica nativa.
          <div
            id={controlId}
            ref={controlRef as React.RefObject<HTMLDivElement>}
            role="combobox"
            tabIndex={disabled ? -1 : 0}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-required={required || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            aria-labelledby={label ? labelId : undefined}
            aria-disabled={disabled || undefined}
            className={cn(styles.control, {
              [styles.open]: open,
              [styles.error]: hasError,
            })}
            onClick={() => !disabled && toggleMenu()}
            onKeyDown={handleControlKeyDown}
          >
            <span className={styles.value}>
              {selectedOptions.length > 0 ? (
                <span className={styles.chips}>
                  {selectedOptions.map((option) => (
                    <span key={option.value} className={styles.chip}>
                      {option.label}
                      <button
                        type="button"
                        aria-label={`Quitar ${option.label}`}
                        className={styles.chipRemove}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeChip(option.value);
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </span>
              ) : (
                <span className={styles.placeholder}>{placeholder}</span>
              )}
            </span>
            <ChevronIcon open={open} />
          </div>
        ) : (
          <button
            type="button"
            id={controlId}
            ref={controlRef as React.RefObject<HTMLButtonElement>}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-required={required || undefined}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            aria-label={!label || isInline ? accessibleName : undefined}
            aria-labelledby={label && !isInline ? labelId : undefined}
            disabled={disabled || isLocked}
            className={cn(styles.control, {
              [styles.open]: open,
              [styles.locked]: isLocked,
              [styles.error]: hasError,
              [styles.inline]: isInline,
            })}
            onClick={toggleMenu}
            onKeyDown={handleControlKeyDown}
          >
            <span className={styles.value}>
              {selectedOptions[0] ? selectedOptions[0].label : <span className={styles.placeholder}>{placeholder}</span>}
            </span>
            <ChevronIcon open={open} />
          </button>
        )}
        {open && (
          <div className={styles.menu}>
            {searchable && (
              <div className={styles.search}>
                <input
                  ref={searchRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="Buscar..."
                  value={query}
                  aria-label={`Buscar en ${accessibleName}`}
                  aria-controls={listboxId}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleControlKeyDown}
                />
              </div>
            )}
            <ul id={listboxId} role="listbox" className={styles.list}>
              {visibleOptions.length === 0 && (
                <li className={styles.noResults} role="presentation">
                  Sin resultados
                </li>
              )}
              {visibleOptions.map((option, index) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(styles.option, {
                    [styles.optionActive]: index === activeIndex,
                    [styles.optionSelected]: isSelected,
                  })}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option.value)}
                >
                  {option.label}
                </li>
              );
              })}
            </ul>
          </div>
        )}
      </div>
      {hasError && (
        <p id={errorId} className={styles.errorMessage}>
          {error}
        </p>
      )}
    </div>
  );
}
