import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/lib/auth';
import TimeAllocation from './page';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/features/time-allocation', () => ({
  WeeklyAllocationTable: () => <div data-testid="weekly-allocation-table" />,
}));

describe('time-allocation/page — TS-61, TS-62, TS-97', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-97: rol external-user redirige a /projects', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ['external-user'] } } as any);

    await TimeAllocation();

    expect(redirect).toHaveBeenCalledWith('/projects');
  });

  it('TS-61: usa ViewHeader — el título es el <h1> "Asignación de Tiempo"', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ['admin'] } } as any);

    const element = await TimeAllocation();
    render(element);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Asignación de Tiempo' })
    ).toBeInTheDocument();
  });

  it('TS-62: no importa PageLayout', () => {
    const content = fs.readFileSync(path.resolve(__dirname, './page.tsx'), 'utf8');
    expect(content).not.toMatch(/PageLayout/);
  });

  it('no queda un <main> anidado dentro del <main> del shell', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ['admin'] } } as any);

    const element = await TimeAllocation();
    const { container } = render(element);

    expect(container.querySelectorAll('main')).toHaveLength(0);
  });
});
