import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '1mb' }));

  // API Routes First
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'gemini-vault',
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware for development vs static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Gemini Vault] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Gemini Vault] Failed to start server:', err);
  process.exit(1);
});
