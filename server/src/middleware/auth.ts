import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { DB } from '../db/connection.js';
import { config } from '../config.js';
import type { AuthUser } from '../types.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export const COOKIE = 'operis_token';

declare module 'express-serve-static-core' {
  interface Request { user: AuthUser }
}

export const signToken = (u: AuthUser) => jwt.sign({ sub: u.id }, config.jwtSecret, { expiresIn: '7d' });

export function requireAuth(db: DB) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE];
    if (!token) throw unauthorized();
    let id: number;
    try { id = Number((jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub); } catch { throw unauthorized(); }
    const u = db.prepare('SELECT id, name, email, role FROM users WHERE id = ? AND active = 1').get(id) as AuthUser | undefined;
    if (!u) throw unauthorized();
    req.user = u;
    next();
  };
}
export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user.role !== 'admin') throw forbidden('Apenas administradores podem executar esta ação.');
  next();
};
