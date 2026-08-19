import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateComment } from '@/features/comments/hooks/useCreateComment';
import { commentsApi } from '@/features/comments/services/commentsApi';
import { vi, type Mocked } from 'vitest';

vi.mock('@/features/comments/services/commentsApi');
const mockCommentsApi = commentsApi as Mocked<typeof commentsApi>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCreateComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama a commentsApi.create con los parámetros correctos', async () => {
    const mockResponse = {
      id: 1,
      typeOfActivity: 'comment' as const,
      previousValue: '',
      newValue: 'Test comment',
      visibilityLevel: 'public' as const,
      requirementId: 123,
      changedBy: 'user-1',
      user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
    };
    mockCommentsApi.create.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useCreateComment(123), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ comment: 'Test comment' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCommentsApi.create).toHaveBeenCalledWith(123, {
      comment: 'Test comment',
    });
  });

  it('retorna isPending: true durante la mutación', async () => {
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockCommentsApi.create.mockImplementationOnce(
      () => pendingPromise as ReturnType<typeof commentsApi.create>
    );

    const { result } = renderHook(() => useCreateComment(123), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ comment: 'Test' });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => {
      resolvePromise({
        id: 1,
        typeOfActivity: 'comment' as const,
        previousValue: '',
        newValue: 'Test',
        visibilityLevel: 'public' as const,
        requirementId: 123,
        changedBy: 'user-1',
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('retorna error cuando la API falla', async () => {
    const errorMessage = 'Internal server error';
    mockCommentsApi.create.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useCreateComment(123), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ comment: 'Test comment' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(new Error(errorMessage));
  });

  it('invalida el query del objetivo tras éxito', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mockResponse = {
      id: 1,
      typeOfActivity: 'comment' as const,
      previousValue: '',
      newValue: 'Test',
      visibilityLevel: 'public' as const,
      requirementId: 456,
      changedBy: 'user-1',
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
    };
    mockCommentsApi.create.mockResolvedValueOnce(mockResponse);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateComment(456), { wrapper });

    await act(async () => {
      result.current.mutate({ comment: 'Test' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['requirement', 456],
    });

    invalidateQueriesSpy.mockRestore();
  });
});
