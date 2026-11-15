import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import {
  githubAccounts,
  githubActivity,
  githubContributions,
  githubRepositories,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  buildGitHubAuthUrl,
  getGitHubOverview,
  getGitHubRedirectUri,
  isGitHubOAuthConfigured,
  syncGitHubDataForUser,
} from '../services/githubService.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const overview = await getGitHubOverview(req.dbUser!.id);
    res.json({
      ...overview,
      callbackUrl: getGitHubRedirectUri(),
    });
  } catch (error) {
    console.error('GET /api/github error:', error);
    res.status(500).json({ error: 'Failed to load GitHub telemetry.' });
  }
});

router.get('/auth-url', async (req: AuthRequest, res) => {
  try {
    if (!isGitHubOAuthConfigured()) {
      return res.status(400).json({
        error: 'GitHub OAuth credentials (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET) are not configured.',
        callbackUrl: getGitHubRedirectUri(),
        configured: false,
      });
    }
    const url = buildGitHubAuthUrl(req.dbUser!.id);
    res.json({ url, callbackUrl: getGitHubRedirectUri(), configured: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to build GitHub OAuth URL.';
    res.status(500).json({ error: msg });
  }
});

router.post('/sync', async (req: AuthRequest, res) => {
  try {
    const overview = await syncGitHubDataForUser(req.dbUser!.id);
    res.json({ ...overview, callbackUrl: getGitHubRedirectUri() });
  } catch (error: unknown) {
    console.error('POST /api/github/sync error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to sync GitHub activity.';
    res.status(502).json({ error: msg });
  }
});

router.delete('/disconnect', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    await db.delete(githubAccounts).where(eq(githubAccounts.userId, userId));
    await db.delete(githubContributions).where(eq(githubContributions.userId, userId));
    await db.delete(githubRepositories).where(eq(githubRepositories.userId, userId));
    await db.delete(githubActivity).where(eq(githubActivity.userId, userId));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/github/disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub account.' });
  }
});

export default router;
