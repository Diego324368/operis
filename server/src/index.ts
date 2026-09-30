import { config } from './config.js';
import { openDatabase } from './db/connection.js';
import { createApp } from './app.js';
import { generateNotifications } from './services/notifications.js';

const db = openDatabase();
const app = createApp(db);

// Gera lembretes a cada minuto (independente de haver usuários com o app aberto)
const tick = () => { try { generateNotifications(db); } catch (e) { console.error('notif', e); } };
tick();
setInterval(tick, 60_000).unref();

const server = app.listen(config.port, () => console.log(`Operis API em http://localhost:${config.port}`));
const stop = () => { server.close(() => { db.close(); process.exit(0); }); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
