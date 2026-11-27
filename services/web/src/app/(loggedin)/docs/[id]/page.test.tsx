import { isValidElement } from 'react';
import { notFound } from 'next/navigation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModules } from '@/features/docs/services/modulesApi';
import DocumentPage from './page';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@/features/docs/services/modulesApi', () => ({ getModules: vi.fn() }));
vi.mock('@/features/docs/components/DocumentView', () => ({
  DocumentView: ({ id }: { id: string }) => <div>{id}</div>,
}));

const ID = '01J9Z3K8M2Q4R6T8V0W2Y4A6C8';
const render = (id: string) => DocumentPage({ params: Promise.resolve({ id }) });

describe('DocumentPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['attachments', 'abc'])(
    'TS-47: id inválido (%s) responde 404 sin consultar módulos',
    async (id) => {
      await expect(render(id)).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFound).toHaveBeenCalled();
      expect(getModules).not.toHaveBeenCalled();
    }
  );

  it.each([[[{ module: 'docs', status: 'not_installed' }]], [[]]])(
    'TS-48: módulo no instalado responde 404 (%j)',
    async (modules) => {
      vi.mocked(getModules).mockResolvedValue(modules as never);
      await expect(render(ID)).rejects.toThrow('NEXT_NOT_FOUND');
    }
  );

  it.each(['available', 'unavailable'])(
    'TS-49: módulo %s renderiza DocumentView',
    async (status) => {
      vi.mocked(getModules).mockResolvedValue([
        { module: 'docs', status, features: { sharing: false } },
      ] as never);
      const element = await render(ID);
      expect(notFound).not.toHaveBeenCalled();
      expect(isValidElement(element)).toBe(true);
      expect((element as { props: { id: string } }).props.id).toBe(ID);
    }
  );
});
