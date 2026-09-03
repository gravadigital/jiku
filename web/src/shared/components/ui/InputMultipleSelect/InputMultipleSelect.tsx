'use client';
import React from 'react';
import Select, { components as selectComponents } from 'react-select';
import { cn } from '@/shared/utils/cn';
import styles from './InputMultipleSelect.module.scss';
import type { MultiValueGenericProps, OptionProps } from 'react-select';

// El control vive en filas de filtros junto a inputs de 40px. Con `isMulti`, react-select
// envuelve los chips en varias filas y el campo crece hasta desalinear la fila entera: por eso
// se muestran como máximo estos chips y el resto se colapsa en un resumen "+N".
const MAX_VISIBLE_CHIPS = 2;

interface Option {
  readonly label: string;
  readonly value: string;
}

interface InputProps {
  readonly label: string;
  readonly code: string;
  readonly value: Array<{ label: string; value: string }>;
  readonly options: Array<{ label: string; value: string }>;
  readonly onChange: (values: Array<{ label: string; value: string }>) => void;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly error?: boolean;
  /**
   * Alto y label de fila de filtros (40px, label de 0.875rem sin sangría), para alinear con los
   * inputs vecinos de `RequirementFilters`. Sin esto queda el alto de formulario (54px, label de
   * 12px sangrado), que es el que usan `Input` y `Select` en `ObjectiveSearchFilters`.
   */
  readonly compact?: boolean;
}

// Reemplaza los chips que exceden el máximo por un único "+N". react-select renderiza un
// MultiValue por opción elegida, así que el recorte se hace acá y no filtrando `value`: el
// control necesita seguir conociendo la selección completa para el menú y el onChange.
function MultiValueContainer(props: MultiValueGenericProps<Option, true>) {
  const { selectProps, data } = props;
  const selected = (selectProps.value as readonly Option[] | null) ?? [];
  const index = selected.findIndex((option) => option.value === data.value);

  if (index < MAX_VISIBLE_CHIPS) {
    return <selectComponents.MultiValueContainer {...props} />;
  }

  // Solo el primer excedente pinta el resumen; los demás no renderizan nada.
  if (index !== MAX_VISIBLE_CHIPS) return null;

  return <span className={styles.overflowCount}>{`+${selected.length - MAX_VISIBLE_CHIPS}`}</span>;
}

// Con `hideSelectedOptions={false}` el menú lista también lo ya elegido, así que necesita mostrar
// cuál está marcado. El checkbox es decorativo (`aria-hidden`): quien lee el estado es el
// `aria-selected` que react-select ya pone en el `role="option"`.
function Option(props: OptionProps<Option, true>) {
  const { isSelected, label } = props;

  return (
    <selectComponents.Option {...props}>
      <span className={styles.option}>
        <span
          aria-hidden="true"
          className={cn(styles.checkbox, { [styles.checkboxChecked]: isSelected })}
        >
          {isSelected ? '✓' : ''}
        </span>
        {label}
      </span>
    </selectComponents.Option>
  );
}

export function InputMultipleSelect(props: InputProps) {
  const {
    label,
    code,
    value,
    options = [],
    onChange,
    error,
    required = false,
    placeholder = '',
    compact = false,
  } = props;

  // El control es de una sola línea en los dos modos; lo que cambia es a qué vecinos se alinea.
  const controlHeight = compact ? '40px' : '54px';
  const innerHeight = compact ? '38px' : '52px';

  const handleChange = (selectedOptions: readonly Option[] | null) => {
    onChange(selectedOptions ? [...selectedOptions] : []);
  };

  const customStyles = {
    control: (provided: Record<string, unknown>, state: { isFocused: boolean }) => ({
      ...provided,
      '&:hover': {
        border: error ? '1px solid red' : '1px solid var(--border-default)',
        cursor: 'pointer',
      },
      backgroundColor: 'var(--bg-surface)',
      border: error ? '1px solid red' : '1px solid var(--border-default)',
      borderRadius: 'var(--radius-field)',
      boxShadow: state.isFocused ? 'var(--focus-ring)' : 'none',
      boxSizing: 'border-box' as const,
      color: 'var(--text-primary)',
      fontSize: compact ? '0.875rem' : '1rem',
      fontWeight: 400,
      // Alto fijo: es lo que impide que el control crezca al sumar estados.
      height: controlHeight,
      // El modo formulario deja el mismo aire entre label y control que `InputText`.
      marginTop: compact ? 0 : '7px',
      minHeight: controlHeight,
      outline: 'none',
      width: '100%',
    }),
    valueContainer: (provided: Record<string, unknown>) => ({
      ...provided,
      alignItems: 'center',
      display: 'flex',
      // `nowrap` es lo que impide que los chips salten de línea y estiren el control.
      flexWrap: 'nowrap' as const,
      gap: '0.25rem',
      height: innerHeight,
      overflow: 'hidden',
      padding: compact ? '0 0.5rem' : '0 0.75rem',
    }),
    multiValue: (provided: Record<string, unknown>) => ({
      ...provided,
      alignItems: 'center',
      backgroundColor: 'var(--bg-tint-neutral)',
      borderRadius: 'var(--radius-field)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexShrink: 0,
      fontFamily: 'var(--font-family-ui)',
      fontSize: compact ? '0.75rem' : '0.875rem',
      margin: 0,
      maxWidth: '9rem',
      padding: '0 0.125rem 0 0.375rem',
    }),
    multiValueLabel: (provided: Record<string, unknown>) => ({
      ...provided,
      color: 'var(--text-primary)',
      fontSize: compact ? '0.75rem' : '0.875rem',
      overflow: 'hidden',
      padding: '2px 0',
      paddingLeft: 0,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    }),
    multiValueRemove: (provided: Record<string, unknown>) => ({
      ...provided,
      '&:hover': {
        backgroundColor: 'transparent',
        color: 'darkred',
      },
      background: 'none',
      border: 'none',
      color: 'red',
      cursor: 'pointer',
      padding: '0 2px',
    }),
    input: (provided: Record<string, unknown>) => ({
      ...provided,
      margin: 0,
      paddingBottom: 0,
      paddingTop: 0,
    }),
    indicatorsContainer: (provided: Record<string, unknown>) => ({
      ...provided,
      height: innerHeight,
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    placeholder: (provided: Record<string, unknown>) => ({
      ...provided,
      fontSize: compact ? '0.875rem' : '1rem',
      margin: 0,
      whiteSpace: 'nowrap' as const,
    }),
    menu: (provided: Record<string, unknown>) => ({
      ...provided,
      fontSize: '0.875rem',
      zIndex: 'var(--z-dropdown)',
    }),
    // El default pinta la opción seleccionada con fondo sólido. Con la lista completa a la vista
    // eso deja el menú entero coloreado: acá lo que marca la selección es el check, y el fondo
    // queda para el hover/teclado.
    option: (
      provided: Record<string, unknown>,
      state: { isFocused: boolean; isSelected: boolean }
    ) => ({
      ...provided,
      ':active': { backgroundColor: 'var(--bg-active-subtle)' },
      backgroundColor: state.isFocused ? 'var(--bg-active-subtle)' : 'transparent',
      color: 'var(--text-primary)',
      cursor: 'pointer',
      fontWeight: state.isSelected ? 'var(--font-weight-medium)' : 400,
    }),
  };

  return (
    <div className={cn(styles.container, { [styles.compact]: compact })}>
      <label className={styles.label} htmlFor={code}>
        {label}
      </label>
      <Select
        id={code}
        instanceId={code}
        name={code}
        value={value}
        onChange={handleChange}
        options={options}
        isMulti
        required={required}
        styles={customStyles}
        placeholder={placeholder}
        components={{ MultiValueContainer, Option }}
        // El menú muestra siempre la lista completa con lo elegido marcado, y no se cierra al
        // elegir: es la única vista donde están todos los valores, porque los chips del control
        // se recortan en el "+N".
        hideSelectedOptions={false}
        closeMenuOnSelect={false}
      />
    </div>
  );
}
