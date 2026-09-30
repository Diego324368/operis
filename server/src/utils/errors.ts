export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
  }
}
export const notFound = (what = 'Registro') => new AppError(404, `${what} não encontrado.`, 'NOT_FOUND');
export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, 'BAD_REQUEST', details);
export const conflict = (msg: string, code = 'CONFLICT', details?: unknown) => new AppError(409, msg, code, details);
export const forbidden = (msg = 'Você não tem permissão para esta ação.') => new AppError(403, msg, 'FORBIDDEN');
export const unauthorized = (msg = 'Sessão expirada. Entre novamente.') => new AppError(401, msg, 'UNAUTHORIZED');
