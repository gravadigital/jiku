'use client';

import { useState } from 'react';
import { MarkdownViewer } from '@/features/attachments/components/MarkdownViewer';
import { ToggleGroup } from '@/shared/components/ui/ToggleGroup';
import styles from './MarkdownEditorWithPreview.module.scss';

type EditorMode = 'edit' | 'preview';

const MODE_OPTIONS: { value: EditorMode; label: string }[] = [
  { value: 'edit', label: 'Editar' },
  { value: 'preview', label: 'Vista previa' },
];

interface MarkdownEditorWithPreviewProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly initialMode?: EditorMode;
}

export function MarkdownEditorWithPreview({
  value,
  onChange,
  placeholder,
  disabled,
  ariaLabel,
  initialMode = 'edit',
}: MarkdownEditorWithPreviewProps) {
  const [mode, setMode] = useState<EditorMode>(initialMode);

  return (
    <div className={styles.container}>
      <ToggleGroup
        label="Modo del editor"
        options={MODE_OPTIONS}
        value={mode}
        onChange={(next) => setMode(next as EditorMode)}
      />

      {mode === 'edit' ? (
        <textarea
          aria-label={ariaLabel}
          className={styles.textarea}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      ) : (
        <div className={styles.preview}>
          {value ? (
            <MarkdownViewer content={value} />
          ) : (
            <p className={styles.placeholder}>{placeholder}</p>
          )}
        </div>
      )}
    </div>
  );
}
