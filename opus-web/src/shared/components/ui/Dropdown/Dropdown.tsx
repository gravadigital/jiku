'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './Dropdown.module.scss';

interface DropdownItem {
  id: string | number;
  label: string;
}

interface DropdownProps {
  trigger?: React.ReactNode;
  renderTrigger?: (isOpen: boolean) => React.ReactNode;
  items: DropdownItem[];
  onSelect: (item: DropdownItem) => void;
  className?: string;
  triggerClassName?: string;
  align?: 'left' | 'right';
  renderItem?: (item: DropdownItem) => React.ReactNode;
}

export function Dropdown({
  trigger,
  renderTrigger,
  items,
  onSelect,
  className,
  triggerClassName,
  align = 'left',
  renderItem,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left?: number; right?: number } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    if (align === 'right') {
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    } else {
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleScroll() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  function handleToggle() {
    if (!isOpen) updatePosition();
    setIsOpen((prev) => !prev);
  }

  function handleSelect(item: DropdownItem) {
    onSelect(item);
    setIsOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') setIsOpen(false);
  }

  const menu =
    isOpen && menuPos
      ? createPortal(
          <ul
            ref={menuRef}
            className={styles.menu}
            role="listbox"
            style={{
              top: menuPos.top,
              ...(menuPos.left !== undefined ? { left: menuPos.left } : { right: menuPos.right }),
            }}
          >
            {items.map((item) => (
              <li key={item.id} role="option" aria-selected="false">
                <button type="button" className={styles.item} onClick={() => handleSelect(item)}>
                  {renderItem ? renderItem(item) : item.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className={`${styles.dropdown} ${className ?? ''}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        ref={buttonRef}
        className={`${styles.trigger}${triggerClassName ? ` ${triggerClassName}` : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {renderTrigger ? renderTrigger(isOpen) : trigger}
        {!triggerClassName && !renderTrigger && (
          <svg
            className={styles.chevron}
            data-open={isOpen}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      {menu}
    </div>
  );
}
