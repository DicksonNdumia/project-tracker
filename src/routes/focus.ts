import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import { focusSessions, projects, tasks } from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getDateKeyInTimezone, shiftDateKey } from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const weekStartKey = shiftDateKey(todayKey, -6);
    const monthStartKey = shiftDateKey(todayKey, -29);

    const [sessions, allTasks, allProjects] = await Promise.all([
      db
        .select()
        .from(focusSessions)
        .where(eq(focusSessions.userId, userId))
        .orderBy(desc(focusSessions.startedAt)),
      db.select().from(tasks).where(eq(tasks.userId, userId)),
      db.select().from(projects).where(eq(projects.userId, userId)),
    ]);

    const taskMap = new Map(allTasks.map((t) => [t.id, t.title]));
    const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));

    let todaySeconds = 0;
    let weekSeconds = 0;
    let monthSeconds = 0;
    let totalFocusSessions = 0;

    const dailyMinutesMap = new Map<string, number>();

    const enrichedSessions = sessions.map((s) => {
      if (s.mode === 'focus' && s.status === 'completed') {
        totalFocusSessions += 1;
        if (s.sessionDate === todayKey) todaySeconds += s.actualSeconds;
        if (s.sessionDate >= weekStartKey && s.sessionDate <= todayKey) {
          weekSeconds += s.actualSeconds;
        }
        if (s.sessionDate >= monthStartKey && s.sessionDate <= todayKey) {
          monthSeconds += s.actualSeconds;
        }
        dailyMinutesMap.set(
          s.sessionDate,
          (dailyMinutesMap.get(s.sessionDate) || 0) + Math.round(s.actualSeconds / 60)
        );
      }

      return {
        ...s,
        taskTitle: s.taskId ? taskMap.get(s.taskId) || null : null,
        projectName: s.projectId ? projectMap.get(s.projectId) || null : null,
      };
    });

    const dailySeries = [];
    for (let i = 13; i >= 0; i--) {
      const dateKey = shiftDateKey(todayKey, -i);
      dailySeries.push({
        date: dateKey.slice(5),
        fullDate: dateKey,
        minutes: dailyMinutesMap.get(dateKey) || 0,
      });
    }

    res.json({
      todayKey,
      summary: {
        todayMinutes: Math.round(todaySeconds / 60),
        weekMinutes: Math.round(weekSeconds / 60),
        monthMinutes: Math.round(monthSeconds / 60),
        totalCompletedSessions: totalFocusSessions,
      },
      dailySeries,
      sessions: enrichedSessions.slice(0, 40),
    });
  } catch (error) {
    console.error('GET /api/focus error:', error);
    res.status(500).json({ error: 'Failed to load focus analytics.' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const b = req.body || {};

    const mode = String(b.mode || 'focus');
    const plannedMinutes = Math.max(1, Number(b.plannedMinutes) || 25);
    const actualSeconds = Math.max(0, Number(b.actualSeconds) || plannedMinutes * 60);
    const status = String(b.status || 'completed');
    const sessionDate =
      typeof b.sessionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.sessionDate)
        ? b.sessionDate
        : todayKey;

    const [created] = await db
      .insert(focusSessions)
      .values({
        userId,
        taskId: b.taskId ? String(b.taskId) : null,
        projectId: b.projectId ? String(b.projectId) : null,
        mode,
        plannedMinutes,
        actualSeconds,
        status,
        notes: String(b.notes || ''),
        sessionDate,
        completedAt: status === 'completed' ? new Date() : null,
      })
      .returning();

    res.status(201).json({ session: created });
  } catch (error) {
    console.error('POST /api/focus error:', error);
    res.status(500).json({ error: 'Failed to save focus session.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const sessionId = String(req.params.id);
    await db
      .delete(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/focus/:id error:', error);
    res.status(500).json({ error: 'Failed to delete focus session.' });
  }
});

export default router;
