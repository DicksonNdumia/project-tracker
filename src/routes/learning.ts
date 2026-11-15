import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import { learningGoals, learningSessions, notifications } from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const goals = await db
      .select()
      .from(learningGoals)
      .where(eq(learningGoals.userId, userId))
      .orderBy(desc(learningGoals.updatedAt));

    const sessions = await db
      .select()
      .from(learningSessions)
      .where(eq(learningSessions.userId, userId))
      .orderBy(desc(learningSessions.sessionDate), desc(learningSessions.createdAt));

    const sessionsByGoal = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const arr = sessionsByGoal.get(s.goalId) || [];
      arr.push(s);
      sessionsByGoal.set(s.goalId, arr);
    }

    const enriched = goals.map((g) => {
      const goalSessions = sessionsByGoal.get(g.id) || [];
      const totalMinutes = goalSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
      return {
        ...g,
        sessions: goalSessions,
        totalMinutes,
      };
    });

    res.json({ goals: enriched, sessions });
  } catch (error) {
    console.error('GET /api/learning error:', error);
    res.status(500).json({ error: 'Failed to load learning goals.' });
  }
});

router.post('/goals', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};
    if (!b.skillName || !String(b.skillName).trim()) {
      return res.status(400).json({ error: 'Skill name is required.' });
    }

    const [created] = await db
      .insert(learningGoals)
      .values({
        userId,
        skillName: String(b.skillName).trim(),
        description: String(b.description || ''),
        currentLevel: String(b.currentLevel || 'Beginner'),
        targetLevel: String(b.targetLevel || 'Advanced'),
        startDate: b.startDate || null,
        targetDate: b.targetDate || null,
        resources: Array.isArray(b.resources) ? b.resources : [],
        progress: Math.max(0, Math.min(100, Number(b.progress) || 0)),
        notes: String(b.notes || ''),
      })
      .returning();

    res.status(201).json({ goal: { ...created, sessions: [], totalMinutes: 0 } });
  } catch (error) {
    console.error('POST /api/learning/goals error:', error);
    res.status(500).json({ error: 'Failed to create learning goal.' });
  }
});

router.patch('/goals/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const goalId = String(req.params.id);
    const [existing] = await db
      .select()
      .from(learningGoals)
      .where(and(eq(learningGoals.id, goalId), eq(learningGoals.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Learning goal not found.' });

    const b = req.body || {};
    const nextProgress =
      b.progress !== undefined
        ? Math.max(0, Math.min(100, Number(b.progress)))
        : existing.progress;

    const [updated] = await db
      .update(learningGoals)
      .set({
        skillName: b.skillName !== undefined ? String(b.skillName).trim() : existing.skillName,
        description: b.description !== undefined ? String(b.description) : existing.description,
        currentLevel:
          b.currentLevel !== undefined ? String(b.currentLevel) : existing.currentLevel,
        targetLevel: b.targetLevel !== undefined ? String(b.targetLevel) : existing.targetLevel,
        startDate: b.startDate !== undefined ? b.startDate : existing.startDate,
        targetDate: b.targetDate !== undefined ? b.targetDate : existing.targetDate,
        resources: Array.isArray(b.resources) ? b.resources : existing.resources,
        progress: nextProgress,
        notes: b.notes !== undefined ? String(b.notes) : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(learningGoals.id, goalId))
      .returning();

    if (nextProgress === 100 && existing.progress < 100) {
      await db.insert(notifications).values({
        userId,
        type: 'learning',
        title: `Skill Goal Completed: ${updated.skillName}`,
        message: `Reached 100% progress on ${updated.skillName}.`,
        linkTab: 'learning',
      });
    }

    res.json({ goal: updated });
  } catch (error) {
    console.error('PATCH /api/learning/goals/:id error:', error);
    res.status(500).json({ error: 'Failed to update learning goal.' });
  }
});

router.delete('/goals/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const goalId = String(req.params.id);
    await db
      .delete(learningGoals)
      .where(and(eq(learningGoals.id, goalId), eq(learningGoals.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/learning/goals/:id error:', error);
    res.status(500).json({ error: 'Failed to delete learning goal.' });
  }
});

router.post('/sessions', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const { goalId, topic, durationMinutes = 45, takeaways = '', sessionDate } = req.body || {};
    if (!goalId || !topic || !String(topic).trim()) {
      return res.status(400).json({ error: 'Goal and topic are required.' });
    }

    const [goal] = await db
      .select()
      .from(learningGoals)
      .where(and(eq(learningGoals.id, String(goalId)), eq(learningGoals.userId, userId)));
    if (!goal) return res.status(404).json({ error: 'Learning goal not found.' });

    const [created] = await db
      .insert(learningSessions)
      .values({
        goalId: String(goalId),
        userId,
        topic: String(topic).trim(),
        durationMinutes: Math.max(1, Number(durationMinutes) || 30),
        takeaways: String(takeaways || ''),
        sessionDate: sessionDate || new Date().toISOString().slice(0, 10),
      })
      .returning();

    // Increment goal progress slightly if under 100
    const nextPct = Math.min(100, goal.progress + Math.max(2, Math.round(created.durationMinutes / 15)));
    await db
      .update(learningGoals)
      .set({ progress: nextPct, updatedAt: new Date() })
      .where(eq(learningGoals.id, goal.id));

    res.status(201).json({ session: created, updatedGoalProgress: nextPct });
  } catch (error) {
    console.error('POST /api/learning/sessions error:', error);
    res.status(500).json({ error: 'Failed to log learning session.' });
  }
});

router.delete('/sessions/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const sessionId = String(req.params.id);
    await db
      .delete(learningSessions)
      .where(and(eq(learningSessions.id, sessionId), eq(learningSessions.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/learning/sessions/:id error:', error);
    res.status(500).json({ error: 'Failed to delete learning session.' });
  }
});

export default router;
