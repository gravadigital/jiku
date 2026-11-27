'use client';

import { useState } from 'react';
import { Sidebar } from '@/features/projects/components/Sidebar';
import { CreateRequirementModal } from '@/features/requirements/components/CreateRequirementModal';
import styles from './layout.module.scss';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className={styles.layout}>
      <Sidebar onNewObjective={() => setIsCreateModalOpen(true)} />
      <main className={styles.main}>{children}</main>
      <CreateRequirementModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
