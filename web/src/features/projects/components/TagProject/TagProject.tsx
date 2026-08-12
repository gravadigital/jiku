import React, { ReactElement } from 'react';
import styles from './TagProject.module.scss';

interface tagProjectProps {
  readonly icon: ReactElement;
  readonly text: string;
}

export function TagProject(props: tagProjectProps) {
  const { text, icon } = props;
  return (
    <div className={styles.container}>
      {icon}
      <p>{text}</p>
    </div>
  );
}
