import './globals.scss';
import React from 'react';
import { Archivo as archivoFont } from 'next/font/google';
import Providers from './providers';

const reemKufi = archivoFont({
  subsets: ['latin'],
  variable: '--font-primary',
  weight: ['100', '400', '500', '600', '700'],
});

export const metadata = {
  description: process.env.APP_DESCRIPTION ?? 'Gestión de proyectos',
  title: process.env.APP_NAME ?? 'Jiku',
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={reemKufi.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
