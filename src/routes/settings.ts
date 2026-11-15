import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import { notifications, userSettings, users } from '../db/schema.ts';
import { getUserProfileBundle } from '../db/users.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { generateSmartNotifications } from '../services/notificationService.ts';
import { recalculateUserStreak } from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const bundle = await getUserProfileBundle(req.dbUser!.id);
    res.json(bundle);
  } catch (error) {
    console.error('GET /api/settings/profile error:', error);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.patch('/profile', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};

    const [updated] = await db
      .update(users)
      .set({
        displayName:
          b.displayName !== undefined ? String(b.displayName).trim() : req.dbUser!.displayName,
        bio: b.bio !== undefined ? String(b.bio) : req.dbUser!.bio,
        portfolioSlug:
          b.portfolioSlug !== undefined
            ? String(b.portfolioSlug)
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, '-')
                .replace(/(^-|-$)/g, '')
            : req.dbUser!.portfolioSlug,
        timezone: b.timezone !== undefined ? String(b.timezone) : req.dbUser!.timezone,
        dailyCommitmentTarget:
          b.dailyCommitmentTarget !== undefined
            ? Math.max(1, Math.min(20, Number(b.dailyCommitmentTarget) || 1))
            : req.dbUser!.dailyCommitmentTarget,
        theme: b.theme !== undefined ? String(b.theme) : req.dbUser!.theme,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    await recalculateUserStreak(userId);
    res.json({ user: updated });
  } catch (error) {
    console.error('PATCH /api/settings/profile error:', error);
    res.status(500).json({ error: 'Failed to update profile (portfolio slug may be in use).' });
  }
});

router.patch('/preferences', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    const [updated] = await db
      .insert(userSettings)
      .values({
        userId,
        emailReminders:
          b.emailReminders !== undefined
            ? Boolean(b.emailReminders)
            : existing?.emailReminders ?? true,
        deadlineAlerts:
          b.deadlineAlerts !== undefined
            ? Boolean(b.deadlineAlerts)
            : existing?.deadlineAlerts ?? true,
        streakReminders:
          b.streakReminders !== undefined
            ? Boolean(b.streakReminders)
            : existing?.streakReminders ?? true,
        milestoneAlerts:
          b.milestoneAlerts !== undefined
            ? Boolean(b.milestoneAlerts)
            : existing?.milestoneAlerts ?? true,
        reminderTime:
          b.reminderTime !== undefined
            ? String(b.reminderTime)
            : existing?.reminderTime ?? '09:00',
        githubAutoSync:
          b.githubAutoSync !== undefined
            ? Boolean(b.githubAutoSync)
            : existing?.githubAutoSync ?? true,
        publicPortfolioEnabled:
          b.publicPortfolioEnabled !== undefined
            ? Boolean(b.publicPortfolioEnabled)
            : existing?.publicPortfolioEnabled ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          emailReminders:
            b.emailReminders !== undefined
              ? Boolean(b.emailReminders)
              : existing?.emailReminders ?? true,
          deadlineAlerts:
            b.deadlineAlerts !== undefined
              ? Boolean(b.deadlineAlerts)
              : existing?.deadlineAlerts ?? true,
          streakReminders:
            b.streakReminders !== undefined
              ? Boolean(b.streakReminders)
              : existing?.streakReminders ?? true,
          milestoneAlerts:
            b.milestoneAlerts !== undefined
              ? Boolean(b.milestoneAlerts)
              : existing?.milestoneAlerts ?? true,
          reminderTime:
            b.reminderTime !== undefined
              ? String(b.reminderTime)
              : existing?.reminderTime ?? '09:00',
          githubAutoSync:
            b.githubAutoSync !== undefined
              ? Boolean(b.githubAutoSync)
              : existing?.githubAutoSync ?? true,
          publicPortfolioEnabled:
            b.publicPortfolioEnabled !== undefined
              ? Boolean(b.publicPortfolioEnabled)
              : existing?.publicPortfolioEnabled ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ settings: updated });
  } catch (error) {
    console.error('PATCH /api/settings/preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
});

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const list = await generateSmartNotifications(req.dbUser!.id);
    res.json({ notifications: list });
  } catch (error) {
    console.error('GET /api/settings/notifications error:', error);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.patch('/notifications/:id/read', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const notifId = String(req.params.id);
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notifId), eq(notifications.userId, userId)))
      .returning();
    res.json({ notification: updated });
  } catch (error) {
    console.error('PATCH /api/settings/notifications/:id/read error:', error);
    res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

router.post('/notifications/read-all', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/settings/notifications/read-all error:', error);
    res.status(500).json({ error: 'Failed to clear notifications.' });
  }
});

export default router;
