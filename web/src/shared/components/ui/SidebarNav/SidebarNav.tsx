'use client';
import React from 'react';
import Link from 'next/link';
import { cn } from '@/shared/utils/cn';
import jikuWordmark from '@root/assets/jikuLogo.svg';
import jikuWordmarkDark from '@root/assets/jikuLogoDark.svg';
import { Avatar } from '../Avatar';
import { TintedIcon } from '../TintedIcon';
import styles from './SidebarNav.module.scss';

// El icono del ítem se recolorea vía TintedIcon (máscara CSS) en vez de un <img> plano:
// es lo que permite que el activo pase a --nav-item-active-icon sin depender de que el
// SVG interno use currentColor. --nav-item-icon es el grafito por defecto.
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
  /**
   * Modo de la firma (S-058): `light` resuelve a `jikuLogo.svg`, `dark` a
   * `jikuLogoDark.svg`. Default `light`. El componente no detecta el tema — lo decide
   * el consumidor, coherente con que tampoco consulta la ruta para `activeKey`.
   */
  readonly mode?: 'light' | 'dark';
  /**
   * Contenido adicional del pie (S-059: el selector de tema), renderizado ENCIMA de
   * «Salir» — «el pie de la sidebar suma el selector-tema, junto a Cerrar sesión»
   * (product-map.md). Prop aditiva y opcional: sin ella, el pie se ve exactamente igual
   * que antes de S-059.
   */
  readonly footerSlot?: React.ReactNode;
}

function resolveIconSrc(icon: string): string {
  return icon;
}

export function SidebarNav({
  items,
  activeKey,
  user,
  onLogout,
  mode = 'light',
  footerSlot,
}: SidebarNavProps) {
  const wordmarkSrc =
    mode === 'dark'
      ? ((jikuWordmarkDark as unknown as { src?: string }).src ?? (jikuWordmarkDark as unknown as string))
      : ((jikuWordmark as unknown as { src?: string }).src ?? (jikuWordmark as unknown as string));

  return (
    <nav className={styles.sidebar} aria-label="Navegación principal">
      <div className={styles.brand}>
        {/* Firma según el modo (foundations/logo.md — "sobre azul oscuro el wordmark pasa
            a niebla"). `mode` llega por prop: el componente no detecta el tema por sí
            mismo. El estampado del atributo de tema en la raíz es responsabilidad de
            S-059; el consumidor (el shell) es quien decide qué modo está activo hoy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolveIconSrc(wordmarkSrc)} alt="Jiku" height={26} />
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
        <div className={styles.footerIdentity}>
          <Avatar name={user.name} size="md" nameVisible />
          <span className={styles.userName}>{user.name}</span>
        </div>
        {footerSlot}
        <button type="button" className={styles.logoutButton} onClick={onLogout} aria-label="Cerrar sesión">
          Salir
        </button>
      </div>
    </nav>
  );
}
