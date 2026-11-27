'use client';
import React, { ReactElement, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/shared/components/ui/Button';
import jikuWordmark from '@root/assets/jikuLogo.svg';
import styles from './styles.module.scss';

export default function Login(): ReactElement {
  const [loading, setLoading] = useState(false);

  const login = () => {
    setLoading(true);
    signIn('zitadel', { callbackUrl: '/login/enter' });
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={(jikuWordmark as unknown as { src?: string }).src ?? (jikuWordmark as unknown as string)}
          alt="Jiku"
          height={26}
        />
      </div>
      <header className={styles.header}>
        <h1 className={styles.loginTitle}>Bienvenido</h1>
        <p className={styles.subtitle}>
          Gestión de proyectos, requisitos y horas del equipo. Entrá con tu cuenta para ver lo que
          tenés asignado.
        </p>
      </header>
      <div className={styles.actions}>
        <Button variant="session" onClick={login} loading={loading}>
          Iniciar sesión
        </Button>
      </div>
    </div>
  );
}
