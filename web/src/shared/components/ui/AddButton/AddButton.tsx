'use client';
import React, { MouseEvent, MouseEventHandler } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import addIcon from '@root/assets/add-icon.svg';
import styles from './AddButton.module.scss';

interface ButtonProps {
  readonly onClick?: MouseEventHandler<Element>;
  readonly href?: string;
  readonly disabled?: boolean;
}

export function AddButton(props: ButtonProps) {
  const { push } = useRouter();
  const { onClick, href, disabled = false } = props;

  const handleClick = (event: MouseEvent) => {
    if (onClick) {
      return onClick(event);
    }
    if (href) {
      return push(href);
    }
    return null;
  };

  return (
    <div className={styles.buttonContainer}>
      <button
        type="button"
        className={`${disabled && styles.disabled} ${styles.primary}`}
        onClick={handleClick}
      >
        <Image
          src={addIcon}
          alt="add icon"
          width={25}
          height={25}
          title="Crear una nueva tarea asociada"
        />
      </button>
    </div>
  );
}
