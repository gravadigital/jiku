import React from 'react';
import styles from './styles.module.scss';

export default function Layout({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <div className={styles.left}>{children}</div>
      <div className={styles.right} />
    </div>
  );
}
