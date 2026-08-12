'use client';
import React, { useRef } from 'react';
import { toast } from 'react-toastify';
import { validateFile } from '@/features/attachments/utils/fileValidation';
import styles from './AttachFileButton.module.scss';

interface AttachFileButtonProps {
  readonly onFileReady: (file: File) => void;
  readonly disabled?: boolean;
}

export function AttachFileButton(props: AttachFileButtonProps) {
  const { onFileReady, disabled } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      inputRef.current!.value = '';
      return;
    }

    onFileReady(file);
    inputRef.current!.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className={styles.hiddenInput}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className={styles.attachButton}
        onClick={handleButtonClick}
        disabled={disabled}
        aria-label="Adjuntar archivo"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
        Adjuntar archivo
      </button>
    </>
  );
}
