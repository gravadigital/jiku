import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { ToastContainer } from 'react-toastify';
import { SessionMonitor } from '@/components/SessionMonitor';
import { auth } from '@/lib/auth';
import { Navbar } from '@/shared/components/layout';
import { Loader } from '@/shared/components/ui';
import styles from './styles.module.scss';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { readonly children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user?.roles?.includes('external-user')) {
    redirect('/unauthorized');
  }
  return (
    <div className={styles.layoutContainer}>
      <SessionMonitor />
      <aside className={styles.sidebarContainer}>
        <Navbar appName={process.env.APP_NAME} externalLinks={process.env.EXTERNAL_LINKS} />
      </aside>
      <main className={styles.mainContainer}>
        <Suspense fallback={<Loader label="Cargando..." />}>{children}</Suspense>
      </main>
      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}
