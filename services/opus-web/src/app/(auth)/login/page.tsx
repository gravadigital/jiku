'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import logo from '@/assets/logo.png';
import styles from './login.module.scss';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  function handleLogin() {
    setLoading(true);
    signIn('zitadel', { callbackUrl: '/login/enter' });
  }

  return (
    <div className={styles.loginPage} data-testid="login-page">
      {/* Arcos decorativos SVG */}
      <div className={styles.bgArcs}>
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="fadeToWhite" x1="0" y1="0" x2="0" y2="1">
              <stop offset="50%" stopColor="#2563eb" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
            </linearGradient>
          </defs>
          <rect width="1440" height="900" fill="url(#fadeToWhite)" />
          {/* ── Left arcs ── */}
          <ellipse
            cx="-140"
            cy="450"
            rx="380"
            ry="600"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="-140"
            cy="450"
            rx="480"
            ry="750"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="-140"
            cy="450"
            rx="580"
            ry="900"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="-140"
            cy="450"
            rx="680"
            ry="1050"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1.5"
          />

          {/* ── Right arcs ── */}
          <ellipse
            cx="1580"
            cy="450"
            rx="380"
            ry="600"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="1580"
            cy="450"
            rx="480"
            ry="750"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="1580"
            cy="450"
            rx="580"
            ry="900"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="1580"
            cy="450"
            rx="680"
            ry="1050"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Card central */}
      <div className={styles.card}>
        {/* Círculo con logo */}
        <div className={styles.logoWrap}>
          <Image src={logo} alt="Opus" width={76} height={76} priority />
        </div>

        <h1 className={styles.title}>¡Bienvenido a OPUS!</h1>

        <p className={styles.description}>
          Seguí el avance de tu proyecto y conocé el estado de cada tarea al instante.
        </p>

        {/* Flecha hacia abajo */}
        <div className={styles.arrow}>
          <svg
            width="24"
            height="32"
            viewBox="0 0 24 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="2" x2="12" y2="28" />
            <polyline points="5 21 12 28 19 21" />
          </svg>
        </div>

        <button className={styles.loginBtn} onClick={handleLogin} disabled={loading}>
          {loading ? 'Cargando...' : 'Iniciar sesión'}
        </button>
      </div>
    </div>
  );
}
