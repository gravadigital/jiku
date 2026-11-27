'use client';

import React, { useEffect, useId, useState } from 'react';
import { Badge } from '@/shared/components/ui';
import { useTopicSuggestions } from '../../hooks/useTopicSuggestions';
import { normalizeTopic } from '../../utils/frontmatterDocument';
import styles from './TopicsInput.module.scss';

const DEBOUNCE_MS = 200;

interface TopicsInputProps {
  readonly value: readonly string[];
  readonly onChange: (topics: string[]) => void;
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}

const countLabel = (n: number): string => (n === 1 ? '1 documento' : `${n} documentos`);

// DS gap aceptado (REQ-021): `Select` `multiple` no admite valores nuevos. Combobox propio con el
// patrón ARIA de `DocsSearchBar`; lo comparten el alta y la edición.
export function TopicsInput({
  value,
  onChange,
  label = 'Temas',
  placeholder = 'Agregar temas',
  disabled = false,
}: TopicsInputProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;

  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const prefix = normalizeTopic(debounced);
  const query = useTopicSuggestions({ prefix, enabled: !disabled && open });
  const suggestions = (query.data?.items ?? []).filter((item) => !value.includes(item.topic));
  const trimmed = text.trim();
  const isOpen = open && !disabled && trimmed.length > 0;
  const optionId = (index: number) => `${listboxId}-opt-${index}`;
  const active = activeIndex >= 0 ? suggestions[activeIndex] : undefined;

  const reset = () => {
    setText('');
    setDebounced('');
    setOpen(false);
    setActiveIndex(-1);
  };

  const add = (raw: string) => {
    const topic = normalizeTopic(raw);
    if (topic !== '' && !value.includes(topic)) onChange([...value, topic]);
    reset();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (trimmed.length === 0) return;
        event.preventDefault();
        if (!isOpen) {
          setOpen(true);
          return;
        }
        const last = suggestions.length - 1;
        if (last < 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => {
          const next = current + step;
          if (next > last) return 0;
          return next < 0 ? last : next;
        });
        return;
      }
      case 'Enter':
        // Nunca envía el formulario ni dispara el "Crear" del diálogo que lo contiene.
        event.preventDefault();
        event.stopPropagation();
        if (isOpen && active) add(active.topic);
        else if (trimmed.length > 0) add(trimmed);
        return;
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setActiveIndex(-1);
        }
        return;
      case 'Backspace':
        if (text === '' && value.length > 0) onChange(value.slice(0, -1));
        return;
      default:
    }
  };

  const showNewHint = isOpen && suggestions.length === 0 && !query.isFetching;

  return (
    <div
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.field}>
        <ul className={styles.chips} aria-label="Temas elegidos">
          {value.map((topic) => (
            <li key={topic} className={styles.chip}>
              <Badge variant="outline" family="neutral" label={topic} />
              <button
                type="button"
                className={styles.remove}
                aria-label={`Quitar tema ${topic}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((t) => t !== topic))}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={isOpen && active ? optionId(activeIndex) : undefined}
          className={styles.input}
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Temas existentes"
        className={styles.listbox}
        hidden={!isOpen || suggestions.length === 0}
      >
        {isOpen &&
          suggestions.map((item, index) => (
            <li
              key={item.topic}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? styles.optionActive : styles.option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(item.topic)}
            >
              <span>{item.topic}</span>
              <span className={styles.count}>{countLabel(item.documents)}</span>
            </li>
          ))}
      </ul>
      {showNewHint && <p className={styles.hint}>{`Enter para agregar «${trimmed}»`}</p>}
      <p className={styles.srOnly} aria-live="polite">
        {isOpen && suggestions.length > 0
          ? `${suggestions.length} ${suggestions.length === 1 ? 'sugerencia' : 'sugerencias'}`
          : ''}
      </p>
    </div>
  );
}
