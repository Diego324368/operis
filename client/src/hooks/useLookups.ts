import { useQuery } from '@tanstack/react-query';
import { clientsApi, lookupApi, settingsApi, statusesApi, usersApi } from '../api/services';
import type { StatusScope } from '../types';

const STALE = 60_000;
export const useAllStatuses = () => useQuery({ queryKey: ['statuses'], queryFn: statusesApi.list, staleTime: STALE });
export function useStatuses(scope?: StatusScope) {
  const q = useAllStatuses();
  return { ...q, data: scope ? q.data?.filter((s) => s.scope === scope) : q.data };
}
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: usersApi.list, staleTime: STALE });
export const useTrainingTypes = () => useQuery({ queryKey: ['training-types'], queryFn: () => lookupApi('training-types').list(), staleTime: STALE });
export const useTaskCategories = () => useQuery({ queryKey: ['task-categories'], queryFn: () => lookupApi('task-categories').list(), staleTime: STALE });
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: settingsApi.get, staleTime: STALE });
export const useCities = () => useQuery({ queryKey: ['cities'], queryFn: clientsApi.cities, staleTime: 30_000 });
