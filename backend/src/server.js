import app from './app.js';
import { readData } from './services/jsonStore.js';
import { ensureDemoDirectory } from './services/demoDirectory.js';

const port = Number(process.env.PORT || 4000);
await readData();
await ensureDemoDirectory();
const host = '0.0.0.0';
const server = app.listen(port, host, () => console.log(`Healthcare API listening on ${host}:${port}`));

async function shutdown(signal) {
  console.log(`${signal} received; closing server.`);
  server.close((error) => process.exit(error ? 1 : 0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
