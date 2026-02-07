import { buildApp } from './app.js';
import { config } from './config/index.js';
import { isMockMode } from './config/mock.js';
import { validateAddresses } from './config/addresses.js';
import { DEFAULT_CHAIN_ID } from './config/chains.js';

async function main() {
  try {
    // Fail fast: reject zero addresses before accepting any traffic
    validateAddresses(DEFAULT_CHAIN_ID);

    const mode = isMockMode() ? 'MOCK' : 'PRODUCTION';

    if (isMockMode()) {
      console.log('🔶 Starting in MOCK MODE (no PostgreSQL/Redis required)');
    } else {
      console.log('🔍 Starting in PRODUCTION MODE');
      // In production mode, database connection will be checked by app.ts
    }

    // Build and start Fastify app
    const app = await buildApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 BaseBook DEX API Server                            ║
║                                                          ║
║   Mode:        ${mode.padEnd(43)}║
║   Environment: ${config.env.padEnd(43)}║
║   Server:      http://${config.host}:${config.port.toString().padEnd(30)}║
║                                                          ║
║   Health:      http://${config.host}:${config.port}/health${' '.repeat(18)}║
║   API:         http://${config.host}:${config.port}/v1${' '.repeat(22)}║
║   WebSocket:   ws://${config.host}:${config.port}/ws${' '.repeat(20)}║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error(error);
    process.exit(1);
  }
}

main();
