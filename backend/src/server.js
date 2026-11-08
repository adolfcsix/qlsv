import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentPort } from './config/env.js';
import { createApp } from './app.js';
export { createApp };
// Run only when this file is invoked as the application entrypoint.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const app = await createApp();
    const port = currentPort();
    app.server.listen(port, '0.0.0.0', () => {
        console.log(`LAC HONG UNIVERSITY full-stack: http://localhost:${port} (${app.db.driver})`);
    });
    async function stop() { app.server.close(async () => { await app.db.close(); process.exit(0); }); }
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
}
