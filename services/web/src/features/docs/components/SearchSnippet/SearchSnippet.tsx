import React from 'react';
import { highlightSnippet } from '../../utils/snippet';
import styles from './SearchSnippet.module.scss';

interface SearchSnippetProps {
  readonly snippet: string;
  readonly q: string;
}

// P-8: el fragmento es texto. Los segmentos se pintan como nodos de texto de React (escapados),
// nunca con `innerHTML`; solo la coincidencia lleva <mark>.
export function SearchSnippet({ snippet, q }: SearchSnippetProps) {
  const segments = highlightSnippet(snippet, q);
  return (
    <p className={styles.snippet}>
      {segments.map((segment, index) =>
        segment.mark ? (
          <mark key={index} className={styles.mark}>
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        )
      )}
    </p>
  );
}
