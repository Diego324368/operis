/**
 * Dados de demonstração. Uso:  npm run db:seed   (adiciona)  |  npm run db:reset  (apaga tudo e recria)
 * As datas são relativas a "hoje" para que o painel sempre mostre situações realistas.
 */
import { rmSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { openDatabase, type DB } from './connection.js';
import { addDays, today } from '../utils/dates.js';
import { createClient } from '../services/clients.js';
import { changeStatus, completeActivity, createActivity } from '../services/activities.js';
import { createUser } from '../services/users.js';
import { firstStatusOfKind } from '../services/statuses.js';
import type { AuthUser } from '../types.js';

export function seedDemo(db: DB) {
  const admin = db.prepare(`SELECT id, name, email, role FROM users WHERE role='admin' ORDER BY id LIMIT 1`).get() as AuthUser;
  let carla = db.prepare(`SELECT id, name, email, role FROM users WHERE email='carla@operis.local'`).get() as AuthUser | undefined;
  carla ??= createUser(db, { name: 'Carla Souza', email: 'carla@operis.local', password: 'carla123', role: 'member' }) as AuthUser;
  const t = today();
  const d = (n: number) => addDays(t, n);
  const tt = (name: string) => (db.prepare('SELECT id FROM training_types WHERE name = ?').get(name) as { id: number }).id;
  const st = (scope: any, kind: string) => firstStatusOfKind(db, scope, kind)!.id;

  const mk = (name: string, o: Record<string, unknown>) => createClient(db, admin, { name, force: true, ...o }) as any;
  const central = mk('Restaurante Central', { trade_name: 'Central Grill', contact_name: 'João Almeida', phone: '(11) 3456-7890', whatsapp: '(11) 98765-4321', email: 'contato@central.example.com', address: 'Rua das Flores, 120', city: 'São Paulo', notes: 'Cliente prefere atendimento pela manhã.\nResponsável pelo estabelecimento é João.\nNecessita treinamento adicional sobre caixa.', is_favorite: true, status_id: st('client', 'in_progress') });
  const lanch = mk('Lanchonete Avenida', { trade_name: 'Avenida Lanches', contact_name: 'Marta Lima', whatsapp: '(11) 97654-3210', address: 'Av. Brasil, 900', city: 'Guarulhos', assignee_id: carla.id });
  const merc = mk('Mercado São José', { trade_name: 'Mercadinho São José', contact_name: 'Seu José', phone: '(19) 3222-1000', address: 'Rua Sete, 45', city: 'Campinas', is_favorite: true, status_id: st('client', 'in_progress') });
  const loja = mk('Loja Exemplo', { contact_name: 'Paula Reis', email: 'paula@lojaexemplo.example.com', whatsapp: '(11) 91234-5678', address: 'Rua Nova, 10', city: 'São Paulo' });
  const padar = mk('Padaria Pão Quente', { contact_name: 'Sérgio', phone: '(11) 2345-6789', city: 'Osasco', status_id: st('client', 'in_progress'), assignee_id: carla.id });
  const pizza = mk('Pizzaria Bella Massa', { contact_name: 'Renata', whatsapp: '(11) 95555-1212', city: 'Santo André' });
  const farm = mk('Farmácia Saúde Já', { contact_name: 'Dr. Marcos', phone: '(11) 4002-8922', city: 'Guarulhos', status_id: st('client', 'done') });

  // Tudo criado por "admin"; histórico de datas passadas é simulado ajustando created_at ao final
  const act = (o: any, user: AuthUser = admin) => createActivity(db, user, { force: true, ...o });
  const done = (a: any, note?: string, user: AuthUser = admin) => completeActivity(db, user, a.id, { note });

  // Restaurante Central: jornada completa
  done(act({ type: 'installation', client_id: central.id, date: d(-14), start_time: '09:00', end_time: '11:30', location: central.address, priority: 'high' }), 'Instalação concluída sem intercorrências.');
  done(act({ type: 'training', client_id: central.id, date: d(-12), start_time: '14:00', end_time: '16:00', training_type_id: tt('Caixa'), content: 'Abertura/fechamento de caixa e sangria.' }), 'Equipe treinada.');
  done(act({ type: 'followup', client_id: central.id, date: d(-5), start_time: '10:00', end_time: '10:30', contact_reason: 'Primeiro acompanhamento pós-treinamento', situation: 'Operando normalmente', problems: 'Dúvida na emissão de nota', solutions: 'Orientado por telefone' }), 'Cliente satisfeito.');
  act({ type: 'followup', client_id: central.id, date: t, start_time: '16:00', end_time: '16:30', contact_reason: 'Segundo acompanhamento', priority: 'medium' });
  act({ type: 'training', client_id: central.id, date: d(2), start_time: '09:00', end_time: '11:00', training_type_id: tt('Relatórios'), content: 'Relatórios gerenciais e fechamento do mês.' });

  // Lanchonete Avenida
  act({ type: 'installation', client_id: lanch.id, date: t, start_time: '14:00', end_time: '15:30', location: lanch.address, priority: 'high', assignee_id: admin.id, notes: 'Levar leitor de código de barras extra.' });
  act({ type: 'training', client_id: lanch.id, training_type_id: tt('Balcão'), priority: 'medium' }); // pendente

  // Mercado São José
  done(act({ type: 'installation', client_id: merc.id, date: d(-10), start_time: '08:30', end_time: '12:00', priority: 'medium' }), 'Rede local revisada.');
  const tr = act({ type: 'training', client_id: merc.id, date: d(-9), start_time: '13:00', end_time: '15:00', training_type_id: tt('Cadastro de produtos') });
  done(tr, 'Cadastro de produtos iniciado.');
  act({ type: 'followup', client_id: merc.id, date: d(-3), start_time: '11:00', contact_reason: 'Verificar cadastro de produtos', priority: 'high' }); // atrasado
  act({ type: 'training', client_id: merc.id, date: d(5), start_time: '09:00', end_time: '10:30', training_type_id: tt('Emissão fiscal') });

  // Loja Exemplo
  act({ type: 'installation', client_id: loja.id, date: d(1), start_time: '10:00', end_time: '12:00', priority: 'medium', location: loja.address });

  // Padaria
  done(act({ type: 'installation', client_id: padar.id, date: d(-20), start_time: '09:00', end_time: '10:30' }, carla), 'Concluída.', carla);
  done(act({ type: 'training', client_id: padar.id, date: d(-19), start_time: '09:00', end_time: '11:00', training_type_id: tt('Balcão') }, carla), 'OK', carla);
  act({ type: 'followup', client_id: padar.id, date: d(3), start_time: '15:00', assignee_id: carla.id, priority: 'low', contact_reason: 'Acompanhamento semanal' }, carla);
  const runN = act({ type: 'installation', client_id: pizza.id, date: t, start_time: '09:00', end_time: '10:00', priority: 'high' });
  changeStatus(db, admin, runN.id, st('installation', 'in_progress'));

  // Farmácia: finalizada
  done(act({ type: 'installation', client_id: farm.id, date: d(-30), start_time: '09:00', end_time: '11:00' }), 'Ok');
  done(act({ type: 'training', client_id: farm.id, date: d(-29), start_time: '09:00', end_time: '11:00', training_type_id: tt('Caixa') }), 'Ok');
  done(act({ type: 'followup', client_id: farm.id, date: d(-15), contact_reason: 'Encerramento do período de acompanhamento' }), 'Cliente concluiu o período.');

  // Tarefas com checklist
  act({ type: 'task', title: 'Confirmar instalação — Lanchonete Avenida', client_id: lanch.id, date: t, start_time: '11:00', end_time: '11:15', priority: 'high', category_id: 3,
    checklist: [{ text: 'Confirmar horário', done: true }, { text: 'Confirmar endereço', done: false }, { text: 'Separar materiais', done: false }, { text: 'Realizar instalação', done: false }, { text: 'Registrar conclusão', done: false }] });
  act({ type: 'task', title: 'Ligar para Seu José (retorno sobre cadastro)', client_id: merc.id, date: d(-1), priority: 'medium', category_id: 1 });
  act({ type: 'task', title: 'Enviar documentação — Loja Exemplo', client_id: loja.id, date: d(2), priority: 'low', category_id: 2 });

  // Eventos
  act({ type: 'meeting', title: 'Reunião de alinhamento semanal', date: t, start_time: '08:30', end_time: '09:00', location: 'Online (Meet)', priority: 'medium' });
  act({ type: 'event', title: 'Visita técnica ao fornecedor', date: d(4), start_time: '10:00', end_time: '12:00', location: 'Zona Norte', priority: 'low' });

  // Ajusta cadastro de clientes antigos para dar profundidade ao histórico/relatórios
  const backdate = db.prepare(`UPDATE clients SET created_at = ? WHERE id = ?`);
  [[central, -16], [merc, -12], [padar, -22], [farm, -32], [lanch, -3], [loja, -1], [pizza, -2]].forEach(([c, n]: any) => backdate.run(`${d(n)}T12:00:00.000Z`, c.id));
  return { admin, carla };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--reset')) {
    for (const s of ['', '-wal', '-shm']) if (existsSync(config.databasePath + s)) rmSync(config.databasePath + s);
  }
  const db = openDatabase();
  if ((db.prepare('SELECT COUNT(*) n FROM clients').get() as { n: number }).n > 0) {
    console.log('O banco já possui clientes. Use "npm run db:reset" para recriar com dados de demonstração.');
  } else {
    seedDemo(db);
    console.log('Dados de demonstração criados. Login: admin@operis.local / admin123 (ou carla@operis.local / carla123)');
  }
}
