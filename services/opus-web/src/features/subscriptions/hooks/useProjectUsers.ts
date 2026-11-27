import { useQuery } from '@tanstack/react-query';
import { subscriptionsApi } from '../services/subscriptionsApi';

export function useProjectUsers(projectId: number) {
  return useQuery({
    queryKey: ['projectUsers', projectId],
    queryFn: () => subscriptionsApi.getProjectUsers(projectId),
    enabled: !!projectId,
  });
}
