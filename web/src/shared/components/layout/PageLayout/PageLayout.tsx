import React from 'react';
import Head from 'next/head';
import styles from './PageLayout.module.scss';

interface LayoutProps {
  readonly title: string;
  readonly label?: string;
  readonly actions?: Array<React.ReactNode>;
  readonly children: React.ReactNode;
}

export function PageLayout(props: LayoutProps) {
  const { title, label, actions = [], children } = props;

  return (
    <div className={styles.generalContainer}>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="icon" href="/public/favicon.ico" />
        <title>{title}</title>
      </Head>
      <header className={styles.headerContainer}>
        <div className={styles.titleContainer}>
          <p className={styles.label}>{label || ''}</p>
          <h1>{title}</h1>
        </div>
        <div className={styles.actionsContainer}>
          {actions.map((action) => {
            return action;
          })}
        </div>
      </header>
      {children}
    </div>
  );
}
