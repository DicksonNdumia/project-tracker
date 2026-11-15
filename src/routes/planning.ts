import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import { dailyPlans, tasks } from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getDateKeyInTimezone, shiftDateKey } from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

router.get('/recent', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const plans = await db
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.userId, userId))
      .orderBy(desc(dailyPlans.planDate))
      .limit(14);
    res.json({ plans });
  } catch (error) {
    console.error('GET /api/planning/recent error:', error);
    res.status(500).json({ error: 'Failed to load recent daily plans.' });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const planDate =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : todayKey;

    const [plan] = await db
      .select()
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.planDate, planDate)));

    const recentPlans = await db
      .select()
      .from(dailyPlans)
      .where(eq(dailyPlans.userId, userId))
      .orderBy(desc(dailyPlans.planDate))
      .limit(10);

    res.json({
      planDate,
      todayKey,
      plan: plan || {
        id: '',
        planDate,
        mits: [],
        tomorrowTasks: [],
        accomplishments: '',
        unfinishedNotes: '',
        challenges: '',
        isReviewed: false,
      },
      recentPlans,
    });
  } catch (error) {
    console.error('GET /api/planning error:', error);
    res.status(500).json({ error: 'Failed to load daily plan.' });
  }
});

router.put('/:date', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const planDate = String(req.params.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
      return res.status(400).json({ error: 'Invalid plan date (expected YYYY-MM-DD).' });
    }

    const b = req.body || {};
    const mits = Array.isArray(b.mits)
      ? b.mits.slice(0, 3).map((m: Record<string, unknown>, idx: number) => ({
          id: String(m.id || `mit-${idx + 1}`),
          title: String(m.title || '').trim(),
          taskId: m.taskId ? String(m.taskId) : null,
          completed: Boolean(m.completed),
        }))
      : [];

    const tomorrowTasks = Array.isArray(b.tomorrowTasks)
      ? b.tomorrowTasks.map((t: Record<string, unknown>, idx: number) => ({
          id: String(t.id || `tmrw-${idx + 1}`),
          title: String(t.title || '').trim(),
          priority: String(t.priority || 'Medium'),
          addedToTasks: Boolean(t.addedToTasks),
        }))
      : [];

    const [saved] = await db
      .insert(dailyPlans)
      .values({
        userId,
        planDate,
        mits,
        tomorrowTasks,
        accomplishments: String(b.accomplishments || ''),
        unfinishedNotes: String(b.unfinishedNotes || ''),
        challenges: String(b.challenges || ''),
        isReviewed: Boolean(b.isReviewed),
      })
      .onConflictDoUpdate({
        target: [dailyPlans.userId, dailyPlans.planDate],
        set: {
          mits,
          tomorrowTasks,
          accomplishments: String(b.accomplishments || ''),
          unfinishedNotes: String(b.unfinishedNotes || ''),
          challenges: String(b.challenges || ''),
          isReviewed: Boolean(b.isReviewed),
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ plan: saved });
  } catch (error) {
    console.error('PUT /api/planning/:date error:', error);
    res.status(500).json({ error: 'Failed to save daily plan.' });
  }
});

router.post('/:date/promote-tomorrow', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const planDate = String(req.params.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
      return res.status(400).json({ error: 'Invalid date.' });
    }

    const [plan] = await db
      .select()
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.planDate, planDate)));

    if (!plan || !plan.tomorrowTasks.length) {
      return res.status(400).json({ error: 'No planned tasks for tomorrow to schedule.' });
    }

    const nextDate = shiftDateKey(planDate, 1);
    const createdTasks = [];
    const updatedTomorrow = [];

    for (const item of plan.tomorrowTasks) {
      if (!item.addedToTasks && item.title.trim()) {
        const [created] = await db
          .insert(tasks)
          .values({
            userId,
            title: item.title.trim(),
            priority: item.priority || 'Medium',
            status: 'Pending',
            categoryName: 'Engineering',
            startDate: nextDate,
            dueDate: nextDate,
            estimatedMinutes: 30,
          })
          .returning();
        createdTasks.push(created);
        updatedTomorrow.push({ ...item, addedToTasks: true });
      } else {
        updatedTomorrow.push(item);
      }
    }

    const [updatedPlan] = await db
      .update(dailyPlans)
      .set({ tomorrowTasks: updatedTomorrow, updatedAt: new Date() })
      .where(eq(dailyPlans.id, plan.id))
      .returning();

    res.json({
      createdCount: createdTasks.length,
      scheduledDate: nextDate,
      plan: updatedPlan,
    });
  } catch (error) {
    console.error('POST /api/planning/:date/promote-tomorrow error:', error);
    res.status(500).json({ error: 'Failed to promote tomorrow tasks.' });
  }
});

export default router;
