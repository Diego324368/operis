import { http } from './http';
import type * as T from '../types';

const q = <O,>(o: O) => o as Record<string, unknown>;

export const authApi = {
  me: () => http<{ user: T.User | null }>('/auth/me'),
  login: (email: string, password: string) => http<{ user: T.User }>('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => http<{ ok: true }>('/auth/logout', { method: 'POST' }),
  updateProfile: (b: Record<string, unknown>) => http<{ user: T.User }>('/auth/me', { method: 'PUT', body: b }),
};

export const dashboardApi = { get: () => http<T.Dashboard>('/dashboard') };
export const searchApi = { search: (text: string) => http<T.SearchResult>('/search', { query: { q: text } }) };

export const clientsApi = {
  list: (f: Record<string, unknown>) => http<{ items: T.Client[]; total: number; page: number; page_size: number }>('/clients', { query: f }),
  cities: () => http<string[]>('/clients/cities'),
  detail: (id: number) => http<{ client: T.Client; activities: T.Activity[]; history: T.HistoryEvent[] }>(`/clients/${id}`),
  create: (b: unknown) => http<T.Client>('/clients', { method: 'POST', body: b }),
  update: (id: number, b: unknown) => http<T.Client>(`/clients/${id}`, { method: 'PUT', body: b }),
  favorite: (id: number, favorite: boolean) => http<T.Client>(`/clients/${id}/favorite`, { method: 'PATCH', body: { favorite } }),
  addNote: (id: number, text: string) => http(`/clients/${id}/notes`, { method: 'POST', body: { text } }),
  remove: (id: number) => http<void>(`/clients/${id}`, { method: 'DELETE' }),
};

export const activitiesApi = {
  list: (f: T.ActivityFilter) => http<T.Activity[]>('/activities', { query: q(f) }),
  get: (id: number) => http<T.Activity>(`/activities/${id}`),
  create: (b: unknown) => http<T.Activity>('/activities', { method: 'POST', body: b }),
  update: (id: number, b: unknown) => http<T.Activity>(`/activities/${id}`, { method: 'PUT', body: b }),
  setStatus: (id: number, status_id: number, note?: string) => http<T.Activity>(`/activities/${id}/status`, { method: 'PATCH', body: { status_id, note } }),
  complete: (id: number, b: { note?: string; next_followup_date?: string }) =>
    http<{ activity: T.Activity; next_followup: T.Activity | null }>(`/activities/${id}/complete`, { method: 'POST', body: b }),
  remove: (id: number) => http<void>(`/activities/${id}`, { method: 'DELETE' }),
  toggleItem: (itemId: number, done: boolean) => http<T.Activity>(`/checklist/${itemId}`, { method: 'PATCH', body: { done } }),
};

export const statusesApi = {
  list: () => http<T.Status[]>('/statuses'),
  create: (b: unknown) => http<T.Status>('/statuses', { method: 'POST', body: b }),
  update: (id: number, b: unknown) => http<T.Status>(`/statuses/${id}`, { method: 'PUT', body: b }),
  remove: (id: number, replaceWith?: number) => http<void>(`/statuses/${id}`, { method: 'DELETE', query: { replace_with: replaceWith } }),
  reorder: (scope: string, ids: number[]) => http<T.Status[]>('/statuses/reorder', { method: 'PUT', body: { scope, ids } }),
};

export const lookupApi = (path: 'training-types' | 'task-categories') => ({
  list: (all = false) => http<T.Lookup[]>(`/${path}`, { query: { all } }),
  create: (name: string) => http<T.Lookup>(`/${path}`, { method: 'POST', body: { name } }),
  update: (id: number, b: { name: string; active?: boolean }) => http<T.Lookup>(`/${path}/${id}`, { method: 'PUT', body: b }),
  remove: (id: number) => http<{ deleted: boolean; deactivated: boolean }>(`/${path}/${id}`, { method: 'DELETE' }),
});

export const usersApi = {
  list: () => http<T.User[]>('/users'),
  create: (b: unknown) => http<T.User>('/users', { method: 'POST', body: b }),
  update: (id: number, b: unknown) => http<T.User>(`/users/${id}`, { method: 'PUT', body: b }),
};
export const settingsApi = {
  get: () => http<T.Settings>('/settings'),
  update: (b: Partial<T.Settings>) => http<T.Settings>('/settings', { method: 'PUT', body: b }),
};
export const notificationsApi = {
  list: () => http<{ items: T.AppNotification[]; unread: number }>('/notifications'),
  read: (id: number) => http(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: () => http('/notifications/read-all', { method: 'POST' }),
};
export const reportsApi = {
  get: (p: Record<string, unknown>) => http<T.Report>('/reports', { query: p }),
  save: (p: Record<string, unknown>) => http<{ id: number }>('/reports/save', { method: 'POST', body: p }),
};
