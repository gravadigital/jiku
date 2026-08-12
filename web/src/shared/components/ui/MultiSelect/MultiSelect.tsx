'use client';
import React from 'react';
import ReactSelect from 'react-select';
import styles from './MultiSelect.module.scss';

interface InputProps {
  readonly label: string;
  readonly code: string;
  readonly value: Array<{ label: string; value: string }>;
  readonly options: Array<{ label: string; value: string }>;
  readonly onChange: (values: Array<{ label: string; value: string }>) => void;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly error?: boolean;
}

export function MultiSelect(props: InputProps) {
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

  const handleChange = (selectedOptions: any) => {
    onChange(selectedOptions || []);
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
      boxSizing: 'border-box',
      color: 'var(--color-general-title)',
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: '1.5rem',
      marginTop: '7px',
      outline: state.isFocused ? '2px solid var(--color-highlighted)' : 'none',
      width: '100%',
    }),
    multiValue: (provided: any) => ({
      ...provided,
      alignItems: 'center',
      backgroundColor: '#f5f2f0',
      borderRadius: 'var(--radius-items)',
      color: '#666',
      display: 'flex',
      fontFamily: 'var(--font-primary)',
      fontSize: '1rem',
      margin: '5px',
      padding: '5px 5px',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: 'var(--color-general-title)',
    }),
    multiValueRemove: (provided: any) => ({
      cursor: 'pointer',
      ...provided,
      '&:hover': {
        color: 'darkred',
      },
      background: 'none',
      border: 'none',
      color: 'red',
      fontSize: '1rem',
      marginLeft: '5px',
    }),
    input: (provided: any) => ({ ...provided, margin: 0, paddingTop: 0, paddingBottom: 0 }),
  };

  return (
    <div className={styles.container}>
      <label htmlFor={code}>{label.toUpperCase()}</label>
      <ReactSelect
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
      />
    </div>
  );
}
