import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listTopics } from '../services/docsApi';
import { useTopicSuggestions } from './useTopicSuggestions';

vi.mock('../services/docsApi', () => ({ listTopics: vi.fn() }));

const TOPICS_VID = {
  items: [
    { topic: 'videoconferencia', documents: 12 },
    { topic: 'video-llamadas', documents: 1 },
  ],
  page: { limit: 10, returned: 2 },
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
}

describe('useTopicSuggestions (TS-13)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta por prefijo con la key del módulo', async () => {
    vi.mocked(listTopics).mockResolvedValue({ ok: true, data: TOPICS_VID });
    const { Wrapper, client } = setup();
    const { result } = renderHook(() => useTopicSuggestions({ prefix: 'vid' }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(TOPICS_VID));
    expect(listTopics).toHaveBeenCalledWith({ prefix: 'vid' });
    expect(client.getQueryData(['docs', 'topics', 'vid'])).toEqual(TOPICS_VID);
  });

  it('sin prefijo o deshabilitado no llama', () => {
    const { Wrapper } = setup();
    renderHook(() => useTopicSuggestions({ prefix: '' }), { wrapper: Wrapper });
    renderHook(() => useTopicSuggestions({ prefix: 'vid', enabled: false }), { wrapper: Wrapper });
    expect(listTopics).not.toHaveBeenCalled();
  });
});
