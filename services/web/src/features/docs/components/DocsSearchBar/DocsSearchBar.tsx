'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useDocsSuggestions } from '../../hooks/useDocsSuggestions';
import { tokenKey, type DocsToken } from '../../utils/docsSearchParams';
import { HighlightedText } from '../HighlightedText';
import styles from './DocsSearchBar.module.scss';
import { FilterToken } from './FilterToken';
import { Icon } from './icons';
import { buildSuggestions, type SuggestionOption } from './suggestionOptions';
import { formatTokenLabel } from './tokenLabels';

const DEBOUNCE_MS = 200;
const PLACEHOLDER_EMPTY = 'Buscá texto o escribí un proyecto, cliente, tema o persona';
const PLACEHOLDER_WITH_TOKENS = 'Sumar otro filtro o texto';
const MIN_TEXT_TOKEN = 2;

interface DocsSearchBarProps {
  readonly tokens: DocsToken[];
  readonly knownLabels: Record<string, string>;
  readonly clientIdForSuggestions?: number;
  readonly disabled: boolean;
  readonly onAdd: (token: DocsToken, label: string) => void;
  readonly onRemove: (index: number) => void;
  readonly onClear: () => void;
}

/**
 * Combobox con tokens: el campo, los filtros activos dentro y la lista de sugerencias.
 * No toca la URL: avisa con `onAdd` / `onRemove` / `onClear` y el contenedor la escribe.
 */
export function DocsSearchBar({
  tokens,
  knownLabels,
  clientIdForSuggestions,
  disabled,
  onAdd,
  onRemove,
  onClear,
}: DocsSearchBarProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const labelsRef = useRef<Record<string, string>>({});

  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const suggestionsQuery = useDocsSuggestions({
    q: debounced,
    clientId: clientIdForSuggestions,
    enabled: !disabled && open,
  });

  const trimmed = text.trim();
  const isOpen = open && !disabled && trimmed.length > 0;
  const list = buildSuggestions(trimmed, suggestionsQuery.data);
  const optionId = (option: SuggestionOption) => `${listboxId}-opt-${option.index}`;
  const activeOption = activeIndex >= 0 ? list.flat[activeIndex] : undefined;

  const announce = (message: string) => setAnnouncement(message);

  const choose = (option: SuggestionOption) => {
    onAdd(option.token, option.name);
    announce(`Filtro ${formatTokenLabel(option.token, option.name)} agregado`);
    setText('');
    setDebounced('');
    setOpen(false);
    setActiveIndex(-1);
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
        const last = list.flat.length - 1;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => {
          const next = current + step;
          if (next > last) return 0;
          return next < 0 ? last : next;
        });
        return;
      }
      case 'Enter': {
        if (disabled) return;
        event.preventDefault();
        if (isOpen && activeOption) {
          choose(activeOption);
        } else if (trimmed.length >= MIN_TEXT_TOKEN) {
          choose(list.leading[0]!);
        }
        return;
      }
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        }
        return;
      case 'Backspace': {
        if (text === '' && tokens.length > 0) {
          const index = tokens.length - 1;
          const token = tokens[index]!;
          const label = labelsRef.current[tokenKey(token)];
          if (label) announce(`Filtro ${label} quitado`);
          onRemove(index);
        }
        return;
      }
      default:
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const rememberLabel = useCallback((token: DocsToken) => {
    return (label: string) => {
      labelsRef.current[tokenKey(token)] = label;
    };
  }, []);

  const renderOption = (option: SuggestionOption) => (
    <li
      key={option.index}
      id={optionId(option)}
      role="option"
      aria-selected={option.index === activeIndex}
      className={option.index === activeIndex ? styles.optionActive : styles.option}
      // El foco se queda en el campo: sin esto el click lo sacaría antes de elegir.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => choose(option)}
    >
      <span className={styles.optionIcon}>
        <Icon name={option.icon} />
      </span>
      <span className={styles.optionLabel}>
        {option.token.kind === 'texto' || option.token.kind.startsWith('sin') ? (
          option.label
        ) : (
          <HighlightedText text={option.label} q={debounced.trim() || trimmed} />
        )}
      </span>
      {option.secondary && <span className={styles.optionSecondary}>{option.secondary}</span>}
    </li>
  );

  return (
    <div className={styles.root} onBlur={handleBlur}>
      <label htmlFor={inputId} className={styles.srOnly}>
        Buscar en la documentación
      </label>
      <div className={disabled ? styles.fieldDisabled : styles.field}>
        <span className={styles.searchIcon}>
          <Icon name="search" />
        </span>
        <ul className={styles.tokens} aria-label="Filtros activos">
          {tokens.map((token) => (
            <FilterToken
              key={tokenKey(token)}
              token={token}
              knownLabels={knownLabels}
              disabled={disabled}
              onLabel={rememberLabel(token)}
              onRemove={(label) => {
                announce(`Filtro ${label} quitado`);
                onRemove(tokens.indexOf(token));
                inputRef.current?.focus();
              }}
            />
          ))}
        </ul>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={isOpen && activeOption ? optionId(activeOption) : undefined}
          className={styles.input}
          placeholder={tokens.length > 0 ? PLACEHOLDER_WITH_TOKENS : PLACEHOLDER_EMPTY}
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
        {tokens.length > 0 && (
          <button
            type="button"
            className={styles.clear}
            aria-label="Quitar todos los filtros"
            disabled={disabled}
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      <ul
        id={listboxId}
        role="listbox"
        aria-label="Sugerencias"
        className={styles.listbox}
        hidden={!isOpen}
      >
        {isOpen && (
          <>
            {list.leading.map(renderOption)}
            {list.groups.map((group) => (
              <li key={group.label} role="presentation" className={styles.group}>
                <span className={styles.groupLabel} aria-hidden="true">
                  {group.label}
                </span>
                <ul role="group" aria-label={group.label} className={styles.groupList}>
                  {group.options.map(renderOption)}
                </ul>
              </li>
            ))}
          </>
        )}
      </ul>

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
