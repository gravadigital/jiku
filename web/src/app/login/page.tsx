'use client';
import React, { MouseEventHandler, ReactElement, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Spinner } from '@/shared/components/ui';
import styles from './styles.module.scss';

export default function Login(): ReactElement {
  const [loading, setLoading] = useState(false);

  const login: MouseEventHandler = (event) => {
    event.preventDefault();
    setLoading(true);
    signIn('zitadel', { callbackUrl: '/login/enter' });
  };

  const showLoader = () => {
    if (loading) {
      return <Spinner />;
    }
    return 'Iniciar sesión';
  };

  return (
    <form className={styles.formContainer}>
      <header className={styles.header}>
        <h1 className={styles.loginTitle}>Bienvenido</h1>
      </header>
      <div>
        <button className={styles.buttonBox} type="submit" onClick={login}>
          {showLoader()}
        </button>
      </div>
    </form>
  );
}
