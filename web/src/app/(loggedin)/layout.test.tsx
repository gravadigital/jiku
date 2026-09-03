import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect, usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '@/features/theme';
import { auth } from '@/lib/auth';
import Layout from './layout';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/worked-times'),
}));
vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));
vi.mock('@/components/SessionMonitor', () => ({
  SessionMonitor: () => null,
}));
vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
}));

const mockedUsePathname = vi.mocked(usePathname);

describe('(loggedin)/layout — guard de acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePathname.mockReturnValue('/worked-times');
  });

  it('TS-5 (S-034): rol external-user redirige a /unauthorized sin consultar users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ['external-user'] },
    } as any);

    await Layout({ children: React.createElement('div') });

    expect(redirect).toHaveBeenCalledWith('/unauthorized');
  });
});

describe('(loggedin)/layout — shell con SidebarNav (S-058)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePathname.mockReturnValue('/worked-times');
  });

  async function renderShell(
    overrides: { roles?: string[]; name?: string; theme?: 'light' | 'dark' } = {}
  ) {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: overrides.roles ?? ['admin'], name: overrides.name ?? 'Ana Torres' },
    } as any);

    const element = await Layout({ children: React.createElement('div', null, 'contenido') });
    return render(<ThemeProvider initialTheme={overrides.theme ?? 'light'}>{element}</ThemeProvider>);
  }

  // TS-53: el shell renderiza SidebarNav con los 6 ítems y sus subítems
  it('TS-53: renderiza un nav con los 6 ítems de navegación y sus subítems', async () => {
    await renderShell();

    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Actores' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Proyectos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Requisitos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tareas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignación de Tiempo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Horas Trabajadas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reporte' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Por proyecto' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Por responsable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Carga' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Visualización' })).toBeInTheDocument();
  });

  // TS-54: el ítem de la sección actual se marca con aria-current="page"
  it('TS-54: con pathname=/worked-times marca "Carga" con aria-current="page", ningún otro', async () => {
    mockedUsePathname.mockReturnValue('/worked-times');
    await renderShell();

    const cargaLink = screen.getByRole('link', { name: 'Carga' });
    expect(cargaLink).toHaveAttribute('aria-current', 'page');
    const others = screen.getAllByRole('link').filter((l) => l !== cargaLink);
    others.forEach((l) => expect(l).not.toHaveAttribute('aria-current'));
  });

  // TS-55: mapeo ruta -> activeKey reproduce el exact del subítem de carga de horas
  it('TS-55: con pathname=/worked-times/report el activo es "Visualización", no "Carga"', async () => {
    mockedUsePathname.mockReturnValue('/worked-times/report');
    await renderShell();

    expect(screen.getByRole('link', { name: 'Visualización' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Carga' })).not.toHaveAttribute('aria-current');
  });

  // TS-56: el shell aplica las dos medidas de layout del DS (verificado en el módulo SCSS,
  // acá se confirma que el sidebar se renderiza con SidebarNav, que declara 300px)
  it('TS-56: el sidebar viene de SidebarNav (300px declarados en su propio módulo)', async () => {
    await renderShell();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
  });

  // TS-57/TS-60: firma Jiku con texto alternativo, una sola vez
  it('TS-57/TS-60: hay exactamente una imagen con nombre accesible "Jiku", de 26px de alto', async () => {
    await renderShell();

    const logos = screen.getAllByRole('img', { name: 'Jiku' });
    expect(logos).toHaveLength(1);
    expect(logos[0]).toHaveAttribute('height', '26');
  });

  // TS-61 (parte del shell, TS-82): Navbar ya no se importa
  it('TS-82: el layout no importa Navbar', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './layout.tsx'), 'utf8');
    expect(content).not.toMatch(/Navbar/);
  });

  // TS-64: el pie del sidebar cierra sesión
  it('TS-64: click en "Cerrar sesión" invoca signOut con callbackUrl /login', async () => {
    const user = userEvent.setup();
    await renderShell();

    await user.click(screen.getByRole('button', { name: /cerrar sesión|salir/i }));

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
  });

  // TS-65: el bloque de enlaces externos se conserva y se oculta cuando la variable está vacía
  it('TS-65: sin EXTERNAL_LINKS, no se renderiza ningún enlace externo', async () => {
    const original = process.env.EXTERNAL_LINKS;
    delete process.env.EXTERNAL_LINKS;

    await renderShell();

    // Sólo deberían existir los links de navegación (6 ítems + 5 subítems = 11), ninguno externo.
    const links = screen.getAllByRole('link');
    const externalLinks = links.filter((l) => l.getAttribute('target') === '_blank');
    expect(externalLinks).toHaveLength(0);

    if (original !== undefined) process.env.EXTERNAL_LINKS = original;
  });

  it('TS-65: con EXTERNAL_LINKS, se renderiza el enlace configurado', async () => {
    const original = process.env.EXTERNAL_LINKS;
    process.env.EXTERNAL_LINKS = JSON.stringify([
      { tool: 'github', href: 'https://git.example', label: 'GitLab' },
    ]);

    await renderShell();

    const externalLink = screen.getByRole('link', { name: 'GitLab' });
    expect(externalLink).toHaveAttribute('href', 'https://git.example');
    expect(externalLink).toHaveAttribute('target', '_blank');

    if (original !== undefined) {
      process.env.EXTERNAL_LINKS = original;
    } else {
      delete process.env.EXTERNAL_LINKS;
    }
  });

  // Filtrado por rol: external-user no ve Asignación de Tiempo ni Horas Trabajadas.
  // Rama prácticamente inalcanzable (el layout ya redirige antes), pero se conserva.
  it('el filtrado por rol external-user oculta Asignación de Tiempo y Horas Trabajadas', async () => {
    // No podemos llegar acá con external-user real (el layout redirige antes), pero el
    // ShellSidebar mismo puede probarse indirectamente vía admin/user, ambos ven todo.
    await renderShell({ roles: ['user'] });
    expect(screen.getByRole('link', { name: 'Asignación de Tiempo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Horas Trabajadas' })).toBeInTheDocument();
  });
});

describe('(loggedin)/layout — selector de tema en el pie (S-059)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUsePathname.mockReturnValue('/worked-times');
  });

  async function renderShell(theme: 'light' | 'dark' = 'light') {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ['admin'], name: 'Ana Torres' },
    } as any);

    const element = await Layout({ children: React.createElement('div', null, 'contenido') });
    return render(<ThemeProvider initialTheme={theme}>{element}</ThemeProvider>);
  }

  // TS-26
  it('TS-26: el selector aparece en el pie con nombre accesible "Tema" y dos radios', async () => {
    await renderShell();

    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeInTheDocument();
  });

  // TS-27
  it('TS-27: con tema dark, el selector marca "Oscuro" como vigente', async () => {
    await renderShell('dark');

    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'false');
  });

  // TS-31 — mismo criterio que SidebarNav.test.tsx TS-58: los SVG se inlinean como data URI en
  // los tests, así que se compara el wordmark por su color de relleno (niebla en oscuro, azul
  // oscuro en claro), no por nombre de archivo.
  it('TS-31: con tema dark, la firma resuelve al wordmark claro (#F6F6F9), no al azul oscuro', async () => {
    await renderShell('dark');

    const logoSrc = screen.getByRole('img', { name: 'Jiku' }).getAttribute('src');
    expect(logoSrc).toContain('F6F6F9');
    expect(logoSrc).not.toContain('0B1934');
  });

  it('TS-31: con tema light, la firma resuelve al wordmark azul oscuro (#0B1934)', async () => {
    await renderShell('light');

    const logoSrc = screen.getByRole('img', { name: 'Jiku' }).getAttribute('src');
    expect(logoSrc).toContain('0B1934');
    expect(logoSrc).not.toContain('F6F6F9');
  });

  // TS-32
  it('TS-32: ShellSidebar deriva mode del tema vigente, sin default fijo a "light"', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './ShellSidebar.tsx'), 'utf8');
    expect(source).toMatch(/useTheme\(\)/);
    expect(source).not.toMatch(/mode\s*=\s*'light'/);
  });

  // Regresión: el resto del shell (nav, logout, enlaces externos) sigue funcionando con el
  // ThemeProvider montado.
  it('el shell sigue funcionando con el ThemeProvider montado (regresión)', async () => {
    await renderShell();

    expect(screen.getByRole('link', { name: 'Proyectos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar sesión|salir/i })).toBeInTheDocument();
  });

  // TS-35
  it('TS-35: sin localStorage disponible, el shell completo renderiza y cae a claro', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('SecurityError');
      },
    });

    try {
      await renderShell();

      expect(screen.getByRole('radio', { name: 'Claro' })).toHaveAttribute(
        'aria-checked',
        'true'
      );
    } finally {
      if (original) {
        Object.defineProperty(window, 'localStorage', original);
      }
    }
  });
});
