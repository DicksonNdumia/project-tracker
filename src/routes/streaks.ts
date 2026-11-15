import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getStreakDashboard } from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const data = await getStreakDashboard(req.dbUser!.id);
    res.json(data);
  } catch (error) {
    console.error('GET /api/streaks error:', error);
    res.status(500).json({ error: 'Failed to load streak tracker.' });
  }
});

router.patch('/target', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const { dailyCommitmentTarget, timezone } = req.body || {};

    const updates: Partial<{ dailyCommitmentTarget: number; timezone: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    };
    if (dailyCommitmentTarget !== undefined) {
      const parsed = Math.max(1, Math.min(20, Number(dailyCommitmentTarget) || 1));
      updates.dailyCommitmentTarget = parsed;
    }
    if (timezone && typeof timezone === 'string') {
      updates.timezone = timezone;
    }

    await db.update(users).set(updates).where(eq(users.id, userId));
    const data = await getStreakDashboard(userId);
    res.json(data);
  } catch (error) {
    console.error('PATCH /api/streaks/target error:', error);
    res.status(500).json({ error: 'Failed to update streak configuration.' });
  }
});

export default router;
