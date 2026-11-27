'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteUnworkedTime } from '../services/unworkedTimesApi';

export const useDeleteUnworkedTime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteUnworkedTime(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unworked-times'] });
      queryClient.invalidateQueries({ queryKey: ['unworked-times-report'] });
    },
  });
};
