import React from 'react';
import Image from 'next/image';
import loader from '@root/assets/loader.svg';
import styles from './Loader.module.scss';

interface LoaderProps {
  readonly label: string;
}

export function Loader({ label }: LoaderProps) {
  return (
    <div className={styles.loaderContainer}>
      <div className={styles.loaderContent}>
        <Image src={loader} alt="loader" height={50} />
        <span>{label}</span>
      </div>
    </div>
  );
}
