'use client';

import React, { useEffect } from 'react';
import styles from './DocsSearchBar.module.scss';
import { Icon } from './icons';
import { formatTokenLabel } from './tokenLabels';
import { useTokenLabel } from './useTokenLabel';
import type { DocsToken } from '../../utils/docsSearchParams';

interface FilterTokenProps {
  readonly token: DocsToken;
  readonly knownLabels: Record<string, string>;
  readonly disabled: boolean;
  readonly onRemove: (label: string) => void;
  /** Para que el buscador pueda anunciar el nombre si se quita con Backspace. */
  readonly onLabel: (label: string) => void;
}

// Un componente por token: cada uno resuelve su nombre con su propio hook.
export function FilterToken({ token, knownLabels, disabled, onRemove, onLabel }: FilterTokenProps) {
  const label = formatTokenLabel(token, useTokenLabel(token, knownLabels));
  useEffect(() => onLabel(label), [label, onLabel]);

  return (
    <li className={styles.token}>
      <span className={styles.tokenText}>{label}</span>
      <button
        type="button"
        className={styles.tokenRemove}
        aria-label={`Quitar filtro ${label}`}
        disabled={disabled}
        onClick={() => onRemove(label)}
      >
        <Icon name="close" size={12} />
      </button>
    </li>
  );
}
