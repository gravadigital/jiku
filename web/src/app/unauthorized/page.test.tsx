import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UnauthorizedPage from './page';

vi.mock('@/lib/auth', () => ({ signOut: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));

describe('UnauthorizedPage (sin-permisos)', () => {
  it('TS-4 (S-034): renderiza el corte por rol con sus tres bloques de contenido', () => {
    render(<UnauthorizedPage />);

    expect(screen.getByRole('heading', { name: /Acceso no autorizado/i })).toBeInTheDocument();
    expect(screen.getByText(/no tiene permisos para acceder/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/i })).toBeInTheDocument();
  });

  it('TS-74: no contiene ningún atributo style={{ en el fuente; importa un módulo scss', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    expect(content).not.toMatch(/style=\{\{/);
    expect(content).toMatch(/styles\.module\.scss/);

    const scssExists = fs.existsSync(path.resolve(__dirname, './styles.module.scss'));
    expect(scssExists).toBe(true);
  });

  it('TS-75: no aparecen los hex hardcodeados #666, #e91e8c ni #fff', () => {
    const tsxContent = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    const scssContent = fs.readFileSync(
      path.resolve(__dirname, './styles.module.scss'),
      'utf8'
    );
    for (const hex of ['#666', '#e91e8c', '#fff']) {
      expect(tsxContent).not.toContain(hex);
      expect(scssContent).not.toContain(hex);
    }
  });

  it('TS-76: el microcopy no cambia', () => {
    render(<UnauthorizedPage />);

    expect(
      screen.getByText('Tu cuenta no tiene permisos para acceder a esta aplicación.')
    ).toBeInTheDocument();
  });

  it('TS-77: el botón de cerrar sesión es el Button del DS variant session, sin <button crudo', () => {
    render(<UnauthorizedPage />);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();

    const pageContent = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    const buttonContent = fs.readFileSync(
      path.resolve(__dirname, './SignOutButton.tsx'),
      'utf8'
    );
    expect(pageContent).not.toMatch(/<button/);
    expect(buttonContent).not.toMatch(/<button/);
  });

  it('TS-78: la Server Action sigue llamando a signOut({ redirectTo: \'/login\' })', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    expect(content).toMatch(/signOut\(\{\s*redirectTo:\s*['"]\/login['"]\s*\}\)/);
  });

  // TS-33 (S-059): las rutas públicas no montan el selector de tema (vive en el shell de (loggedin)).
  it('S-059 TS-33: no monta el selector de tema (no hay sidebar en esta ruta)', () => {
    render(<UnauthorizedPage />);
    expect(screen.queryByRole('radiogroup', { name: 'Tema' })).not.toBeInTheDocument();
  });

  // TS-8c (S-059): sin fondo propio, .container hereda --bg-canvas; título y mensaje resuelven a
  // los tokens de texto del bloque oscuro (verificado por su clase de módulo, no por CSSOM: jsdom
  // no resuelve custom properties).
  it('S-059 TS-8c: .container no fija un fondo claro propio (hereda de --bg-canvas)', () => {
    const styleContent = fs.readFileSync(path.resolve(__dirname, './styles.module.scss'), 'utf8');
    const containerRule = styleContent.match(/\.container\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(containerRule).not.toMatch(/background/);

    render(<UnauthorizedPage />);
    expect(screen.getByRole('heading', { name: /Acceso no autorizado/i }).className).toMatch(
      /title/
    );
    expect(screen.getByText(/no tiene permisos para acceder/i).className).toMatch(/message/);
  });
});
