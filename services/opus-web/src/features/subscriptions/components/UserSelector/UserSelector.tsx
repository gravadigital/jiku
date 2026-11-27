'use client';

import { useRef, useState } from 'react';
import { useProjectUsers } from '@/features/subscriptions/hooks/useProjectUsers';
import styles from './UserSelector.module.scss';

interface UserSelectorProps {
  projectId: number;
  selectedUserIds: string[];
  onChange: (selectedIds: string[]) => void;
  triggerClassName?: string;
}

export function UserSelector({
  projectId,
  selectedUserIds,
  onChange,
  triggerClassName,
}: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { data: users, isLoading } = useProjectUsers(projectId);

  function addUser(userId: string) {
    onChange([...selectedUserIds, userId]);
    setIsOpen(false);
  }

  function handleTriggerClick() {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen((v) => !v);
  }

  const availableUsers = users?.filter((u) => !selectedUserIds.includes(u.id));

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? styles.trigger}
        onClick={handleTriggerClick}
      >
        <span>Seleccionar suscriptor</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{ marginLeft: 'auto', flexShrink: 0, color: '#cbd5e1' }}
        >
          <path
            d="M2 3.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className={styles.panel} style={panelStyle}>
          {isLoading && <div className={styles.loading}>Cargando...</div>}
          {availableUsers?.length === 0 && !isLoading && (
            <div className={styles.empty}>Sin usuarios disponibles</div>
          )}
          {availableUsers?.map((user) => (
            <div
              key={user.id}
              role="option"
              aria-selected={false}
              className={styles.option}
              onClick={() => addUser(user.id)}
            >
              {user.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
