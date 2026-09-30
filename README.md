# Operis

Sistema web de gestão operacional de clientes: cadastro, instalações, treinamentos, acompanhamentos, tarefas, agenda, relatórios (PDF/Excel/CSV) e produtividade.

**Stack:** React + Vite + TypeScript (cliente) · Node 22 + Express 5 + SQLite (better-sqlite3) + zod (servidor).

## Início rápido

```bash
npm install && npm run setup     # dependências
cp server/.env.example server/.env
npm run seed:reset               # (opcional) dados de demonstração
npm run dev                      # http://localhost:5173
```

Login de desenvolvimento: `admin@operis.local` / `admin123` (colaborador de demonstração: `carla@operis.local` / `carla123`).

Produção: `npm run build && NODE_ENV=production npm start` (defina `JWT_SECRET`) ou `docker compose up -d --build`.

Documentação completa (arquitetura, banco, funcionalidades, deploy, manutenção): `docs/Operis_Documentacao.pdf`.
