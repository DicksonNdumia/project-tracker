import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import assistantRouter from './src/routes/assistant.ts';
import careerRouter from './src/routes/career.ts';
import dashboardRouter from './src/routes/dashboard.ts';
import dataRouter from './src/routes/data.ts';
import focusRouter from './src/routes/focus.ts';
import githubRouter from './src/routes/github.ts';
import journalRouter from './src/routes/journal.ts';
import learningRouter from './src/routes/learning.ts';
import planningRouter from './src/routes/planning.ts';
import projectsRouter from './src/routes/projects.ts';
import reportsRouter from './src/routes/reports.ts';
import settingsRouter from './src/routes/settings.ts';
import streaksRouter from './src/routes/streaks.ts';
import tasksRouter from './src/routes/tasks.ts';
import {
  connectAndSyncGitHub,
  exchangeGitHubCodeForToken,
  getGitHubRedirectUri,
  verifySignedOAuthState,
} from './src/services/githubService.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // GitHub OAuth Callback Handler (popup window closes via postMessage)
  app.get(['/auth/github/callback', '/auth/github/callback/'], async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const errorParam = typeof req.query.error === 'string' ? req.query.error : '';

    if (errorParam) {
      return res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc;">
          <p>GitHub authorization cancelled: ${errorParam}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: ${JSON.stringify(errorParam)} }, '*');
              window.close();
            }
          </script>
        </body></html>
      `);
    }

    const verified = verifySignedOAuthState(state);
    if (!code || !verified) {
      return res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc;">
          <p>Invalid or expired GitHub OAuth state. Please close this window and retry.</p>
        </body></html>
      `);
    }

    try {
      const redirectUri = getGitHubRedirectUri();
      const { accessToken, scope } = await exchangeGitHubCodeForToken(code, redirectUri);
      await connectAndSyncGitHub(verified.userId, accessToken, scope);

      res.send(`
        <html>
          <body style="font-family:system-ui,sans-serif;padding:24px;background:#0f172a;color:#f8fafc;">
            <p>GitHub connected and synchronized. Closing window...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'github' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'GitHub connection failed';
      console.error('GitHub OAuth callback error:', err);
      res.status(500).send(`
        <html><body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc;">
          <p>GitHub connection failed: ${msg}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: ${JSON.stringify(msg)} }, '*');
            }
          </script>
        </body></html>
      `);
    }
  });

  // API Routes
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/streaks', streaksRouter);
  app.use('/api/github', githubRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/learning', learningRouter);
  app.use('/api/journal', journalRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/planning', planningRouter);
  app.use('/api/focus', focusRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/career', careerRouter);
  app.use('/api/data', dataRouter);
  app.use('/api/assistant', assistantRouter);

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Progress Tracker server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
