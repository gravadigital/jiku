import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { getModules } from './modulesApi';

vi.mock('@/lib/axios', () => ({ apiClient: { get: vi.fn() } }));

describe('getModules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-1: devuelve el array de la api sin transformar', async () => {
    const data = [{ module: 'docs', status: 'available', features: { sharing: true } }];
    vi.mocked(apiClient.get).mockResolvedValue({ data });

    await expect(getModules()).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/modules');
  });
});
