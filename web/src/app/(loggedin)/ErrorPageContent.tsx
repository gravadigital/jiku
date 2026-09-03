import React from 'react';
import styles from './ErrorPageContent.module.scss';

interface ErrorPageContentProps {
  // string | undefined, igual que CustomError['message']: si el error no trae mensaje,
  // el <p> se renderiza vacío — mismo comportamiento que la JSX inline que reemplaza.
  readonly message?: string;
}

// S-060 (T7): los 4 error.tsx de app/(loggedin)/{projects,objectives,objectives/by-project,
// objectives/by-responsible} eran el mismo componente copiado, apoyado en la regla global
// `h1`/`p` de globals.scss. Se unifican acá con clase propia sobre tokens semánticos, que es
// la precondición para dar de baja esa regla global (mismo patrón que ya usaba
// app/login/enter/error.tsx, fuera de (loggedin) y sin tocar en esta story).
export function ErrorPageContent({ message }: ErrorPageContentProps) {
  return (
    <>
      <h1 className={styles.title}>Error</h1>
      <p className={styles.message}>{message}</p>
    </>
  );
}
