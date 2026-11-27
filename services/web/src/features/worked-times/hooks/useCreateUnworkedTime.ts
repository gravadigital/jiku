'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUnworkedTime } from '../services/unworkedTimesApi';
import type { UnworkedTimeCreate } from '../types/unworked-time.types';

export const useCreateUnworkedTime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UnworkedTimeCreate) => createUnworkedTime(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unworked-times'] });
      queryClient.invalidateQueries({ queryKey: ['unworked-times-report'] });
    },
  });
};
