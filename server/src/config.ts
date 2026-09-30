import { existsSync } from 'node:fs';
import path from 'node:path';

// Carrega .env (Node >= 22) sem dependência extra
const envFile = path.resolve(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)) {
  throw new Error('JWT_SECRET deve ser definido (mín. 24 caracteres) em produção.');
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 3333),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  databasePath: process.env.DATABASE_PATH ?? './data/operis.db',
  timezone: process.env.TZ ?? 'America/Sao_Paulo',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  admin: {
    name: process.env.ADMIN_NAME ?? 'Administrador',
    email: process.env.ADMIN_EMAIL ?? 'admin@operis.local',
    password: process.env.ADMIN_PASSWORD ?? 'admin123',
  },
};
