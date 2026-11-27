import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.scss';
import { Providers } from './providers';

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Opus',
  description: 'Opus Web Application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geistMono.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
