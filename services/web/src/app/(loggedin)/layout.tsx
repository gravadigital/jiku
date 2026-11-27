import React, { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { SessionMonitor } from '@/components/SessionMonitor';
import { auth } from '@/lib/auth';
import { Loader } from '@/shared/components/ui';
import { ExternalLinksBlock } from './ExternalLinksBlock';
import { ShellSidebar } from './ShellSidebar';
import styles from './styles.module.scss';
import { ThemedToastContainer } from './ThemedToastContainer';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { readonly children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user?.roles?.includes('external-user')) {
    redirect('/unauthorized');
  }

  const isExternalUser = session.user?.roles?.includes('external-user') ?? false;
  const userName = session.user?.name ?? '';

  return (
    <div className={styles.layoutContainer}>
      <SessionMonitor />
      <aside className={styles.sidebarContainer}>
        <ShellSidebar isExternalUser={isExternalUser} userName={userName} />
        <ExternalLinksBlock externalLinks={process.env.EXTERNAL_LINKS} />
      </aside>
      <main className={styles.mainContainer}>
        <Suspense fallback={<Loader label="Cargando..." />}>{children}</Suspense>
      </main>
      <ThemedToastContainer />
    </div>
  );
}
