'use client';
import React from 'react';
import Link from 'next/link';
import { cn } from '@/shared/utils/cn';
import jikuWordmark from '@root/assets/jikuLogo.svg';
import { Avatar } from '../Avatar';
import { TintedIcon } from '../TintedIcon';
import styles from './SidebarNav.module.scss';

// El icono del ítem se recolorea vía TintedIcon (máscara CSS) en vez de un <img> plano:
// es lo que permite que el activo pase a --nav-item-active-icon (#12897A) sin depender
// de que el SVG interno use currentColor. --nav-item-icon es el grafito por defecto.
const NAV_ICON_COLOR_DEFAULT = 'var(--nav-item-icon)';
const NAV_ICON_COLOR_ACTIVE = 'var(--nav-item-active-icon)';

export interface SidebarNavSubItem {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

export interface SidebarNavItem {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly href: string;
  readonly children?: readonly SidebarNavSubItem[];
}

export interface SidebarNavUser {
  readonly name: string;
  readonly initials: string;
}

export interface SidebarNavProps {
  readonly items: readonly SidebarNavItem[];
  /** Key del ítem o subítem activo. Llega por prop: el componente no consulta la ruta. */
  readonly activeKey: string;
  readonly user: SidebarNavUser;
  readonly onLogout: () => void;
}

function resolveIconSrc(icon: string): string {
  return icon;
}

export function SidebarNav({ items, activeKey, user, onLogout }: SidebarNavProps) {
  return (
    <nav className={styles.sidebar} aria-label="Navegación principal">
      <div className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveIconSrc((jikuWordmark as unknown as { src?: string }).src ?? (jikuWordmark as unknown as string))} alt="Jiku" height={26} />
      </div>
      <ul className={styles.list}>
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const hasActiveChild = item.children?.some((child) => child.key === activeKey);
          return (
            <li key={item.key} className={styles.item}>
              <Link
                href={item.href}
                className={cn(styles.link, { [styles.linkActive]: isActive })}
                aria-current={isActive ? 'page' : undefined}
              >
                <span aria-hidden="true" className={styles.iconWrapper}>
                  <TintedIcon
                    src={resolveIconSrc(item.icon)}
                    alt=""
                    color={isActive ? NAV_ICON_COLOR_ACTIVE : NAV_ICON_COLOR_DEFAULT}
                    size={22}
                  />
                </span>
                <span>{item.label}</span>
              </Link>
              {item.children && item.children.length > 0 && (
                <ul className={cn(styles.subList, { [styles.subListVisible]: Boolean(isActive || hasActiveChild) })}>
                  {item.children.map((child) => {
                    const isChildActive = child.key === activeKey;
                    return (
                      <li key={child.key} className={styles.subItem}>
                        <Link
                          href={child.href}
                          className={cn(styles.subLink, {
                            [styles.subLinkActive]: isChildActive,
                          })}
                          aria-current={isChildActive ? 'page' : undefined}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className={styles.footer}>
        <Avatar name={user.name} size="md" nameVisible />
        <span className={styles.userName}>{user.name}</span>
        <button type="button" className={styles.logoutButton} onClick={onLogout} aria-label="Cerrar sesión">
          Salir
        </button>
      </div>
    </nav>
  );
}
