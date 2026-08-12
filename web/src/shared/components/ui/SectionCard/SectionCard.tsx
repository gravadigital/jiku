import React from 'react';
import styles from './SectionCard.module.scss';

interface SectionCardProps {
  readonly children: React.ReactNode;
}

export function SectionCard(props: SectionCardProps) {
  const { children } = props;

  return <section className={styles.sectionCardContainer}>{children}</section>;
}
