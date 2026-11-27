'use client';
import React from 'react';
import styles from './styles.module.scss';
import type { CustomError } from '@/shared/types';

export default function ErrorPage({ error }: { readonly error: CustomError }) {
  return (
    <>
      <h1 className={styles.title}>Error</h1>
      <p className={styles.message}>{error.message}</p>
    </>
  );
}
