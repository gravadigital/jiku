'use client';
import React from 'react';
import Select from 'react-select';
import styles from './InputSelect.module.scss';

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

export function InputSelect(props: InputProps) {
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

  return (
    <div className={styles.container}>
      <label htmlFor={code}>{label.toUpperCase()}</label>
      <Select
        id={code}
        instanceId={code}
        name={code}
        value={options.find((option) => option.value === value)}
        onChange={handleChange}
        options={options}
        required={required}
        styles={customStyles}
        placeholder={placeholder}
      />
    </div>
  );
}
