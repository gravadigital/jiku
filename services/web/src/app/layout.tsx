import './globals.scss';
import React from 'react';
import { Sora, Gabarito } from 'next/font/google';
import { cookies } from 'next/headers';
import { THEME_STORAGE_KEY } from '@/features/theme';
import { resolveTheme } from '@/features/theme/utils/themeStorage';
import Providers from './providers';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['700'],
});

const gabarito = Gabarito({
  subsets: ['latin'],
  variable: '--font-ui',
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  description: process.env.APP_DESCRIPTION ?? 'Gestión de proyectos',
  title: process.env.APP_NAME ?? 'Jiku',
};

export default async function RootLayout({ children }: { readonly children: React.ReactNode }) {
  // Estampa data-theme en <html> ANTES de la primera pintura, leyendo la cookie reflejo
  // (jiku.theme, no la de sesión) que el ThemeProvider escribe en el navegador. Cubre las
  // cuatro rutas públicas por igual (/, /login, /login/enter, /unauthorized), porque el <html>
  // se declara acá y no en (loggedin)/layout.tsx (CA-3). Sin cookie o con valor inválido,
  // resolveTheme cae al claro por defecto.
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_STORAGE_KEY)?.value);

  return (
    <html lang="en" data-theme={theme}>
      <body className={`${sora.variable} ${gabarito.variable} ${gabarito.className}`}>
        <Providers initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  );
}
