import { app } from '../server/app.ts';
import { getDatabase } from '../server/db.ts';

// Cache database connection across warm serverless invocations
let isDbReady = false;
async function ensureDb() {
  if (!isDbReady) {
    try {
      await getDatabase();
      isDbReady = true;
    } catch (err) {
      console.error('[Bestie Vercel] Database initialization notice:', err);
    }
  }
}

export default async function handler(req: any, res: any) {
  await ensureDb();
  return app(req, res);
}
