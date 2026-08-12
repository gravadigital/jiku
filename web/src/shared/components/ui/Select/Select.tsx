'use client';
import React from 'react';
import ReactSelect from 'react-select';
import styles from './Select.module.scss';

interface InputProps {
  readonly label: string;
  readonly code: string;
  readonly value: string;
  readonly options: Array<{
    label: string;
    value: string;
  }>;
  readonly onChange: (text: string) => void;
  readonly required?: boolean;
  readonly error?: boolean;
  readonly placeholder?: string;
}

export function Select(props: InputProps) {
  const {
    label,
    code,
    value,
    options = [],
    onChange,
    error,
    required = false,
    placeholder = '',
  } = props;

  const handleChange = (selectedOption: any) => {
    onChange(selectedOption ? selectedOption.value : '');
  };

  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      '&:hover': {
        cursor: 'pointer',
      },
      backgroundColor: '#fff',
      border: error ? '1px solid red' : '0.5px solid var(--color-general-border)',
      borderRadius: 'var(--radius-items)',
      color: 'var(--color-general-title)',
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: '1.5rem',
      marginTop: '7px',
      outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
      width: '100%',
    }),
    input: (provided: any) => ({ ...provided, margin: 0, paddingTop: 0, paddingBottom: 0 }),
  };

  const selectId = `select-${code}`;
  const labelId = `${selectId}-label`;

  return (
    <div className={styles.container}>
      <label id={labelId} htmlFor={selectId}>
        {label.toUpperCase()}
      </label>
      <ReactSelect
        inputId={selectId}
        instanceId={code}
        name={code}
        value={options.find((option) => option.value === value)}
        onChange={handleChange}
        options={options}
        required={required}
        aria-labelledby={labelId}
        aria-required={required}
        aria-invalid={error || undefined}
        styles={customStyles}
        placeholder={placeholder}
      />
    </div>
  );
}
