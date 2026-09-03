'use client';
import React, { useId, useRef } from 'react';
import { cn } from '@/shared/utils/cn';
import styles from './Tabs.module.scss';

export interface TabItem {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface TabsProps {
  readonly tabs: readonly TabItem[];
  readonly activeKey: string;
  readonly onChange: (key: string) => void;
  readonly children?: React.ReactNode;
}

export function Tabs({ tabs, activeKey, onChange, children }: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeIndex = tabs.findIndex((tab) => tab.key === activeKey);

  const focusTabAt = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    tabRefs.current[tab.key]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = (index + 1) % tabs.length;
      focusTabAt(next);
      onChange(tabs[next].key);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = (index - 1 + tabs.length) % tabs.length;
      focusTabAt(prev);
      onChange(tabs[prev].key);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusTabAt(0);
      onChange(tabs[0].key);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const last = tabs.length - 1;
      focusTabAt(last);
      onChange(tabs[last].key);
    }
  };

  return (
    <div>
      <div role="tablist" className={styles.tablist}>
        {tabs.map((tab, index) => {
          const isActive = tab.key === activeKey;
          const tabId = `${baseId}-tab-${tab.key}`;
          const panelId = `${baseId}-panel-${tab.key}`;
          return (
            <button
              key={tab.key}
              id={tabId}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              className={cn(styles.tab, { [styles.tabActive]: isActive })}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className={styles.label}>{tab.label}</span>
              <span className={styles.count} aria-hidden="true">
                {tab.count}
              </span>
              <span className={styles.srOnly}>
                {tab.label}, {tab.count} elemento{tab.count === 1 ? '' : 's'}
              </span>
            </button>
          );
        })}
      </div>
      {children && activeIndex !== -1 && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeKey}`}
          aria-labelledby={`${baseId}-tab-${activeKey}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
