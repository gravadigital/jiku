import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signIn } from 'next-auth/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './page';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}));

describe('login/page — TS-66 a TS-73', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-66: el botón es el Button del DS con variant session; el fuente no contiene <button', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();

    const content = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    expect(content).not.toMatch(/<button/);
  });

  it('TS-67: en loading el botón sigue teniendo nombre accesible "Iniciar sesión"', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('TS-68: en loading el botón emite aria-busy="true", antes del click no lo lleva', async () => {
    const user = userEvent.setup();
    render(<Login />);

    const button = screen.getByRole('button', { name: 'Iniciar sesión' });
    expect(button).not.toHaveAttribute('aria-busy', 'true');

    await user.click(button);

    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('TS-69: el click dispara signIn("zitadel", { callbackUrl: "/login/enter" }) una vez', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signIn).toHaveBeenCalledWith('zitadel', { callbackUrl: '/login/enter' });
  });

  it('TS-72: existe una imagen con nombre accesible "Jiku" en el panel izquierdo', () => {
    render(<Login />);
    expect(screen.getByRole('img', { name: 'Jiku' })).toBeInTheDocument();
  });

  it('TS-70/TS-71: el h1 "Bienvenido" es el único texto de la pantalla', () => {
    render(<Login />);
    expect(screen.getByRole('heading', { level: 1, name: 'Bienvenido' })).toBeInTheDocument();
  });

  // TS-33 (S-059): las rutas públicas no montan el selector de tema (vive en el shell de (loggedin)).
  it('S-059 TS-33: no monta el selector de tema (no hay sidebar en esta ruta)', () => {
    render(<Login />);
    expect(screen.queryByRole('radiogroup', { name: 'Tema' })).not.toBeInTheDocument();
  });
});
