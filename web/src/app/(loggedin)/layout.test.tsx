import React from 'react';
import { redirect } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/lib/auth';
import Layout from './layout';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

describe('(loggedin)/layout — guard de acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TS-5 (S-034): rol external-user redirige a /unauthorized sin consultar users', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ['external-user'] },
    } as any);

    await Layout({ children: React.createElement('div') });

    expect(redirect).toHaveBeenCalledWith('/unauthorized');
  });
});
