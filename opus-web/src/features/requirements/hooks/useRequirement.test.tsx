import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, type Mock } from 'vitest';
import { defaultQueryClientOptions } from '@/lib/queryClient';
import { requirementsApi } from '../services/requirementsApi';
import { useRequirement } from './useRequirement';

vi.mock('../services/requirementsApi');
const mockGetById = requirementsApi.getById as Mock;

const NOT_FOUND_404 = {
  code: 'requirement_not_found',
  message: 'Requirement not found',
  status: 404,
};
const FORBIDDEN_403 = { code: 'access_denied', message: 'Access denied', status: 403 };
const INTERNAL_500 = { code: 'internal_error', message: 'Internal error', status: 500 };
const NETWORK = { code: 'unknown_error', message: 'Error desconocido', status: 500 };

function setup(requirementId: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { ...defaultQueryClientOptions.queries, retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useRequirement({ requirementId }), { wrapper }) };
}

describe('useRequirement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TS-7: 404 no se reintenta', async () => {
    mockGetById.mockRejectedValue(NOT_FOUND_404);
    const { result } = setup(345);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGetById).toHaveBeenCalledTimes(1);
    expect(mockGetById).toHaveBeenCalledWith(345);
    expect(result.current.error).toEqual(NOT_FOUND_404);
  });

  it('TS-8: 403 no se reintenta', async () => {
    mockGetById.mockRejectedValue(FORBIDDEN_403);
    const { result } = setup(345);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });

  it('TS-9: 5xx se reintenta una vez', async () => {
    mockGetById.mockRejectedValue(INTERNAL_500);
    const { result } = setup(345);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockGetById).toHaveBeenCalledTimes(2);
  });

  it('TS-10: red, reintento y éxito', async () => {
    mockGetById
      .mockRejectedValueOnce(NETWORK)
      .mockResolvedValueOnce({ id: 345, projectId: 12, title: 'Login con SSO' });
    const { result } = setup(345);
    await waitFor(() => expect(result.current.data?.id).toBe(345));
    expect(result.current.isError).toBe(false);
    expect(mockGetById).toHaveBeenCalledTimes(2);
  });

  it('TS-11: key y enabled sin cambios', async () => {
    mockGetById.mockResolvedValue({ id: 345 });
    const first = setup(345);
    await waitFor(() => expect(first.result.current.data?.id).toBe(345));
    expect(first.client.getQueryCache().find({ queryKey: ['requirement', 345] })).toBeDefined();

    vi.clearAllMocks();
    setup(0);
    expect(mockGetById).not.toHaveBeenCalled();
  });
});
