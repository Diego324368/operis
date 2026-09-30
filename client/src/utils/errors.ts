import { ApiError } from '../api/http';
export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Ocorreu um erro inesperado.');
export const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError && e.fields ? e.fields : {});
