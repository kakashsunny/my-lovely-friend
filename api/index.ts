import { app } from '../server/app';
import { getDatabase } from '../server/db';

let dbInitPromise: Promise<any> | null = null;

async function ensureDb() {
  if (!dbInitPromise) {
    dbInitPromise = getDatabase().catch(err => {
      console.warn('[Bestie Serverless] DB init notice:', err);
      dbInitPromise = null;
      return null;
    });
  }
  return dbInitPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await ensureDb();
  } catch (_) {}
  return app(req, res);
}

