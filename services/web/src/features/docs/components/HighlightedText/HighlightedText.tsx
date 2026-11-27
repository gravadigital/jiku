import React from 'react';
import { highlightSnippet } from '../../utils/snippet';
import styles from './HighlightedText.module.scss';

interface HighlightedTextProps {
  readonly text: string;
  readonly q: string;
}

// Texto plano con <mark> en la coincidencia (insensible a acentos); nunca `innerHTML`.
export function HighlightedText({ text, q }: HighlightedTextProps) {
  return (
    <span>
      {highlightSnippet(text, q).map((segment, index) =>
        segment.mark ? (
          <mark key={index} className={styles.mark}>
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        )
      )}
    </span>
  );
}
