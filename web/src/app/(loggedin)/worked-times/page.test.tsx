import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/lib/auth';
import WorkedTimes from './page';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/features/worked-times', () => ({
  WorkedTimesPage: () => <div data-testid="worked-times-page" />,
}));

describe('worked-times/page — TS-61, TS-62, TS-97', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-97: rol external-user redirige a /projects', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ['external-user'] } } as any);

    await WorkedTimes();

    expect(redirect).toHaveBeenCalledWith('/projects');
  });

  it('TS-61: usa ViewHeader — el título es el <h1> "Horas Trabajadas"', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ['admin'] } } as any);

    const element = await WorkedTimes();
    render(element);

    expect(screen.getByRole('heading', { level: 1, name: 'Horas Trabajadas' })).toBeInTheDocument();
  });

  it('TS-62: no importa PageLayout', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    expect(content).not.toMatch(/PageLayout/);
  });

  it('no queda un <main> anidado dentro del <main> del shell', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ['admin'] } } as any);

    const element = await WorkedTimes();
    const { container } = render(element);

    expect(container.querySelectorAll('main')).toHaveLength(0);
  });
});
