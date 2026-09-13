import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { app } from './server/app.ts';
import { getDatabase } from './server/db.ts';

dotenv.config();

const PORT = 3000;

async function startServer() {
  // Ensure database is initialized
  try {
    await getDatabase();
  } catch (dbErr) {
    console.warn('[Bestie] Initial DB connection warning (will retry automatically):', dbErr);
  }

  // Serve public static assets (favicons, manifest, etc.)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware for development & static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Bestie] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Bestie] Server failed to start:', err);
});
