import 'dotenv/config';

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthenticatedRequest } from './server/middleware/auth';
import journalRouter from './server/routes/journal';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global Middleware
  app.use(express.json({ limit: '1mb' }));

  // Public Health Endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'gemini-vault',
      timestamp: new Date().toISOString(),
    });
  });

  // Protected Auth Verification Endpoint (Stage 2)
  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'No user identity attached' });
      return;
    }

    res.json({
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
    });
  });

  // Journal API Routes (Stage 3)
  app.use('/api/journal', journalRouter);

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
