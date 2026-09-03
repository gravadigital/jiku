import './globals.scss';
import React from 'react';
import { Sora, Gabarito } from 'next/font/google';
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

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sora.variable} ${gabarito.variable} ${gabarito.className}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
