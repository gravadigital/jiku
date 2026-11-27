'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.scss';

interface ToastItem {
  id: number;
  message: string;
  type: 'error' | 'success';
}

let listeners: ((toast: ToastItem) => void)[] = [];
let nextId = 0;

export function showToast(message: string, type: 'error' | 'success' = 'error') {
  const toast = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function add(toast: ToastItem) {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000);
    }
    listeners.push(add);
    return () => {
      listeners = listeners.filter((fn) => fn !== add);
    };
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`} role="alert">
          {t.type === 'success' ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M5 8l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 5v3M8 10.5v.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
