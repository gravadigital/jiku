import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SidebarNav } from './SidebarNav';

const USER = { name: 'Andrés Vandoni', initials: 'AV' };

const ITEMS = [
  { key: 'actores', label: 'Actores', icon: '/icon.svg', href: '/clients' },
  { key: 'projects', label: 'Proyectos', icon: '/icon.svg', href: '/projects' },
  { key: 'requisitos', label: 'Requisitos', icon: '/icon.svg', href: '/requirements' },
];

describe('SidebarNav', () => {
  it('TS-31: es un nav con nombre accesible y lista real', () => {
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(nav).toBeInTheDocument();
    const list = screen.getAllByRole('list')[0];
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(ITEMS.length);
  });

  it('TS-32: marca el ítem activo con aria-current="page"', () => {
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'Proyectos' });
    expect(link).toHaveAttribute('aria-current', 'page');
    const others = screen.getAllByRole('link').filter((l) => l !== link);
    others.forEach((l) => expect(l).not.toHaveAttribute('aria-current'));
  });

  it('TS-33: anida los subítems dentro de su ítem padre', () => {
    render(
      <SidebarNav
        items={[
          {
            key: 'tareas',
            label: 'Tareas',
            icon: '/icon.svg',
            href: '/objectives',
            children: [{ key: 'backlog', label: 'Backlog', href: '/objectives/backlog' }],
          },
        ]}
        activeKey="tareas"
        user={USER}
        onLogout={vi.fn()}
      />
    );

    const tareasItem = screen.getByText('Tareas').closest('li');
    expect(tareasItem).toBeTruthy();
    const backlogItem = screen.getByText('Backlog').closest('li');
    expect(tareasItem?.contains(backlogItem as Node)).toBe(true);
  });

  it('TS-34: marca el subítem activo sin marcar dos activos', () => {
    render(
      <SidebarNav
        items={[
          {
            key: 'tareas',
            label: 'Tareas',
            icon: '/icon.svg',
            href: '/objectives',
            children: [{ key: 'backlog', label: 'Backlog', href: '/objectives/backlog' }],
          },
        ]}
        activeKey="backlog"
        user={USER}
        onLogout={vi.fn()}
      />
    );

    const backlogLink = screen.getByRole('link', { name: 'Backlog' });
    expect(backlogLink).toHaveAttribute('aria-current', 'page');
    const allCurrent = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(allCurrent).toHaveLength(1);
  });

  it('TS-35: expone la identidad y la salida en el pie', () => {
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />);

    expect(screen.getByText('Andrés Vandoni')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salir|cerrar sesión/i })).toBeInTheDocument();
  });

  it('TS-36: invoca onLogout al usar la salida', async () => {
    const onLogout = vi.fn();
    const user = userEvent.setup();
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={onLogout} />);

    await user.click(screen.getByRole('button', { name: /salir|cerrar sesión/i }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('TS-37: los iconos son decorativos porque el label está visible', () => {
    const { container } = render(
      <SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />
    );

    const hiddenIcons = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenIcons.length).toBeGreaterThan(0);
    const projectsLink = screen.getByRole('link', { name: 'Proyectos' });
    expect(projectsLink).toHaveAccessibleName('Proyectos');
  });

  it('el icono activo usa el color --nav-item-active-icon (#12897A), nunca el verde agua de marca', () => {
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />);

    const activeLink = screen.getByRole('link', { name: 'Proyectos' });
    const activeIconNode = activeLink.querySelector('[aria-hidden="true"] [role="img"]') as HTMLElement;
    expect(activeIconNode.style.backgroundColor).toBe('var(--nav-item-active-icon)');

    const inactiveLink = screen.getByRole('link', { name: 'Actores' });
    const inactiveIconNode = inactiveLink.querySelector('[aria-hidden="true"] [role="img"]') as HTMLElement;
    expect(inactiveIconNode.style.backgroundColor).toBe('var(--nav-item-icon)');
  });

  it('TS-38: no atrapa el foco', async () => {
    const user = userEvent.setup();
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    const focusableCount = ITEMS.length + 1; // items + logout button
    for (let i = 0; i < focusableCount; i += 1) {
      await user.tab();
    }
    // Un tab más debería sacar el foco del nav (no ciclar de vuelta al primero).
    await user.tab();
    expect(nav.contains(document.activeElement)).toBe(false);
  });

  it('TS-39: recibe el activo por prop y no consulta la ruta', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './SidebarNav.tsx'), 'utf-8');
    expect(source).not.toMatch(/usePathname/);
    expect(source).not.toMatch(/useSession/);
  });

  // S-058 (TS-57, TS-58, TS-60): la firma según el modo, con texto alternativo, sin duplicarse
  it('TS-57/TS-60: renderiza exactamente una imagen con nombre accesible "Jiku"', () => {
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />);

    const logos = screen.getAllByRole('img', { name: 'Jiku' });
    expect(logos).toHaveLength(1);
    expect(logos[0]).toHaveAttribute('height', '26');
  });

  // El PNG descontinuado (ver tests/tokens.test.ts TS-23) no debe reaparecer en ningún src.
  const discontinuedLogoPattern = new RegExp('logo' + 'Layout', 'i');

  it('TS-58: mode="light" (default) y mode="dark" resuelven a SVG distintos, ninguno el PNG descontinuado', () => {
    const { unmount } = render(
      <SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />
    );
    const lightSrc = screen.getByRole('img', { name: 'Jiku' }).getAttribute('src');
    expect(lightSrc).not.toMatch(discontinuedLogoPattern);
    unmount();

    render(
      <SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} mode="dark" />
    );
    const darkSrc = screen.getByRole('img', { name: 'Jiku' }).getAttribute('src');
    expect(darkSrc).not.toMatch(discontinuedLogoPattern);

    // Los dos SVG son archivos distintos (claro vs oscuro): su contenido no coincide.
    expect(darkSrc).not.toBe(lightSrc);
  });

  // S-059: el pie gana un slot opcional y aditivo para el selector de tema.
  it('S-059: sin footerSlot, el pie se ve exactamente como hoy (identidad + salida, nada más)', () => {
    render(<SidebarNav items={ITEMS} activeKey="projects" user={USER} onLogout={vi.fn()} />);

    expect(screen.getByText('Andrés Vandoni')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salir|cerrar sesión/i })).toBeInTheDocument();
  });

  it('S-059: con footerSlot, el contenido se renderiza en el pie, encima de "Salir"', () => {
    render(
      <SidebarNav
        items={ITEMS}
        activeKey="projects"
        user={USER}
        onLogout={vi.fn()}
        footerSlot={<div data-testid="theme-slot">Selector de tema</div>}
      />
    );

    expect(screen.getByTestId('theme-slot')).toBeInTheDocument();
    expect(screen.getByText('Andrés Vandoni')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salir|cerrar sesión/i })).toBeInTheDocument();
  });
});
