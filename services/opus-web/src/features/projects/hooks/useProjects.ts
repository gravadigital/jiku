import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../services/projectsApi';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });
}
