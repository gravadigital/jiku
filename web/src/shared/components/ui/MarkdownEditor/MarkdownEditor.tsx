'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import 'easymde/dist/easymde.min.css';
import styles from './MarkdownEditor.module.scss';

const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { ssr: false });

interface MarkdownEditorProps {
  readonly label?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly required?: boolean;
}

export function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: MarkdownEditorProps) {
  return (
    <div className={styles.editorWrapper}>
      {label && (
        <label className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <SimpleMDE
        value={value}
        onChange={onChange}
        options={{
          placeholder: placeholder || '',
          spellChecker: false,
          status: false,
          toolbar: [
            'bold',
            'italic',
            'heading',
            '|',
            'quote',
            'unordered-list',
            'ordered-list',
            '|',
            'link',
            'preview',
          ],
        }}
      />
    </div>
  );
}
