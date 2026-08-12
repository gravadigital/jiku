import React from 'react';
import styles from './Card.module.scss';

interface SectionCardProps {
  readonly children: React.ReactNode;
}

export function Card(props: SectionCardProps) {
  const { children } = props;

  return <article className={styles.sectionCardContainer}>{children}</article>;
}
