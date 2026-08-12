import React from 'react';
import styles from './Header.module.scss';

interface headerProps {
  readonly title: string;
  readonly children: React.ReactNode;
}

export function Header(props: headerProps) {
  const { title, children } = props;
  return (
    <header className={styles.header}>
      <h1>{title}</h1>
      {children}
    </header>
  );
}
