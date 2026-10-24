import { isValidElement } from 'react';
import { notFound } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModules } from '@/features/docs/services/modulesApi';
import DocsPage from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@/features/docs/services/modulesApi', () => ({ getModules: vi.fn() }));
vi.mock('@/features/docs/components/DocsBrowser', () => ({
  DocsBrowser: () => <div>browser</div>,
}));

describe('DocsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([[[{ module: 'docs', status: 'not_installed' }]], [[]]])(
    'TS-46: módulo no instalado responde 404 (%j)',
    async (modules) => {
      vi.mocked(getModules).mockResolvedValue(modules as never);
      await expect(DocsPage()).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFound).toHaveBeenCalled();
    }
  );

  it.each(['available', 'unavailable'])(
    'TS-47: módulo %s renderiza DocsBrowser',
    async (status) => {
      vi.mocked(getModules).mockResolvedValue([
        { module: 'docs', status, features: { sharing: false } },
      ] as never);
      const element = await DocsPage();
      expect(notFound).not.toHaveBeenCalled();
      expect(isValidElement(element)).toBe(true);
    }
  );
});
