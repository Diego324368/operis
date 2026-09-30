import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada.', code: 'NOT_FOUND' });
}

/** Converte erros em respostas JSON sem expor detalhes internos. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of err.issues) fields[i.path.join('.') || '_'] ??= i.message;
    return res.status(400).json({ error: Object.values(fields)[0] ?? 'Dados inválidos.', code: 'VALIDATION', fields });
  }
  if (err instanceof AppError) {
    const d = err.details as { fields?: unknown } | undefined;
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details, fields: d?.fields });
  }
  if ((err as any)?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requisição inválida.', code: 'BAD_REQUEST' });
  console.error(err);
  res.status(500).json({ error: 'Ocorreu um erro inesperado. Tente novamente.', code: 'INTERNAL' });
}
