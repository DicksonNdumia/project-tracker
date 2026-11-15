import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import { subtasks, taskCategories, tasks } from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  getDateKeyInTimezone,
  recalculateUserStreak,
  shiftDateKey,
} from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

function computeNextRecurrenceDate(baseDate: string, recurrence: string): string {
  if (recurrence === 'Daily') return shiftDateKey(baseDate, 1);
  if (recurrence === 'Weekly') return shiftDateKey(baseDate, 7);
  if (recurrence === 'Monthly') {
    const [y, m, d] = baseDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m, d));
    return dt.toISOString().slice(0, 10);
  }
  return baseDate;
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));

    const allSubtasks = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.userId, userId))
      .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));

    const categories = await db
      .select()
      .from(taskCategories)
      .where(eq(taskCategories.userId, userId))
      .orderBy(asc(taskCategories.name));

    const subtasksByTask = new Map<string, typeof allSubtasks>();
    for (const s of allSubtasks) {
      const list = subtasksByTask.get(s.taskId) || [];
      list.push(s);
      subtasksByTask.set(s.taskId, list);
    }

    const enriched = allTasks.map((t) => ({
      ...t,
      subtasks: subtasksByTask.get(t.id) || [],
    }));

    res.json({ tasks: enriched, categories });
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    res.status(500).json({ error: 'Failed to load tasks.' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);

    const {
      title,
      description = '',
      categoryName = 'Engineering',
      priority = 'Medium',
      status = 'Pending',
      isDailyCommitment = false,
      recurrence = 'None',
      startDate = todayKey,
      dueDate = todayKey,
      estimatedMinutes = 30,
      actualMinutes = null,
      notes = '',
      projectId = null,
      dependsOnTaskId = null,
      subtasks: initialSubtasks = [],
    } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const [created] = await db
      .insert(tasks)
      .values({
        userId,
        projectId: projectId ? String(projectId) : null,
        dependsOnTaskId: dependsOnTaskId ? String(dependsOnTaskId) : null,
        title: title.trim(),
        description: String(description || ''),
        categoryName: String(categoryName || 'Engineering'),
        priority: String(priority || 'Medium'),
        status: String(status || 'Pending'),
        isDailyCommitment: Boolean(isDailyCommitment),
        recurrence: String(recurrence || 'None'),
        startDate: startDate || null,
        dueDate: dueDate || null,
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : 30,
        actualMinutes: actualMinutes ? Number(actualMinutes) : null,
        notes: String(notes || ''),
        completedAt: status === 'Completed' ? new Date() : null,
      })
      .returning();

    const createdSubtasks = [];
    if (Array.isArray(initialSubtasks)) {
      for (let i = 0; i < initialSubtasks.length; i++) {
        const subTitle =
          typeof initialSubtasks[i] === 'string'
            ? initialSubtasks[i]
            : initialSubtasks[i]?.title;
        if (subTitle && String(subTitle).trim()) {
          const [sub] = await db
            .insert(subtasks)
            .values({
              taskId: created.id,
              userId,
              title: String(subTitle).trim(),
              isCompleted: Boolean(initialSubtasks[i]?.isCompleted),
              sortOrder: i,
            })
            .returning();
          createdSubtasks.push(sub);
        }
      }
    }

    if (status === 'Completed') {
      await recalculateUserStreak(userId);
    }

    res.status(201).json({ task: { ...created, subtasks: createdSubtasks } });
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const taskId = String(req.params.id);
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);

    const [existing] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

    if (!existing) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const payload = req.body || {};
    if (payload.dependsOnTaskId && String(payload.dependsOnTaskId) === taskId) {
      return res.status(400).json({ error: 'A task cannot depend on itself.' });
    }

    const nextStatus = payload.status !== undefined ? String(payload.status) : existing.status;
    const isNowCompleted = nextStatus === 'Completed';
    const wasCompleted = existing.status === 'Completed';

    const [updated] = await db
      .update(tasks)
      .set({
        projectId:
          payload.projectId !== undefined
            ? payload.projectId
              ? String(payload.projectId)
              : null
            : existing.projectId,
        dependsOnTaskId:
          payload.dependsOnTaskId !== undefined
            ? payload.dependsOnTaskId
              ? String(payload.dependsOnTaskId)
              : null
            : existing.dependsOnTaskId,
        title: payload.title !== undefined ? String(payload.title).trim() : existing.title,
        description:
          payload.description !== undefined ? String(payload.description) : existing.description,
        categoryName:
          payload.categoryName !== undefined
            ? String(payload.categoryName)
            : existing.categoryName,
        priority: payload.priority !== undefined ? String(payload.priority) : existing.priority,
        status: nextStatus,
        isDailyCommitment:
          payload.isDailyCommitment !== undefined
            ? Boolean(payload.isDailyCommitment)
            : existing.isDailyCommitment,
        recurrence:
          payload.recurrence !== undefined ? String(payload.recurrence) : existing.recurrence,
        startDate: payload.startDate !== undefined ? payload.startDate : existing.startDate,
        dueDate: payload.dueDate !== undefined ? payload.dueDate : existing.dueDate,
        estimatedMinutes:
          payload.estimatedMinutes !== undefined
            ? Number(payload.estimatedMinutes)
            : existing.estimatedMinutes,
        actualMinutes:
          payload.actualMinutes !== undefined
            ? payload.actualMinutes === null
              ? null
              : Number(payload.actualMinutes)
            : existing.actualMinutes,
        notes: payload.notes !== undefined ? String(payload.notes) : existing.notes,
        completedAt: isNowCompleted ? existing.completedAt || new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    // Spawn next recurring task if newly completed
    let spawnedRecurring = null;
    if (isNowCompleted && !wasCompleted && updated.recurrence !== 'None') {
      const baseDue = updated.dueDate || todayKey;
      const nextDue = computeNextRecurrenceDate(baseDue, updated.recurrence);
      const [spawned] = await db
        .insert(tasks)
        .values({
          userId,
          categoryId: updated.categoryId,
          projectId: updated.projectId,
          categoryName: updated.categoryName,
          title: updated.title,
          description: updated.description,
          priority: updated.priority,
          status: 'Pending',
          isDailyCommitment: updated.isDailyCommitment,
          recurrence: updated.recurrence,
          startDate: nextDue,
          dueDate: nextDue,
          estimatedMinutes: updated.estimatedMinutes,
          notes: updated.notes,
        })
        .returning();
      spawnedRecurring = { ...spawned, subtasks: [] };
    }

    if (isNowCompleted !== wasCompleted || payload.isDailyCommitment !== undefined) {
      await recalculateUserStreak(userId);
    }

    const taskSubtasks = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.taskId, taskId))
      .orderBy(asc(subtasks.sortOrder));

    res.json({
      task: { ...updated, subtasks: taskSubtasks },
      spawnedRecurring,
    });
  } catch (error) {
    console.error('PATCH /api/tasks/:id error:', error);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const taskId = String(req.params.id);
    const deleted = await db
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await recalculateUserStreak(userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/tasks/:id error:', error);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

router.post('/:id/subtasks', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const taskId = String(req.params.id);
    const { title } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Subtask title is required.' });
    }

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const existingSubs = await db
      .select()
      .from(subtasks)
      .where(eq(subtasks.taskId, taskId));

    const [created] = await db
      .insert(subtasks)
      .values({
        taskId,
        userId,
        title: String(title).trim(),
        sortOrder: existingSubs.length,
      })
      .returning();

    res.status(201).json({ subtask: created });
  } catch (error) {
    console.error('POST /api/tasks/:id/subtasks error:', error);
    res.status(500).json({ error: 'Failed to create subtask.' });
  }
});

router.patch('/subtasks/:subId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const subId = String(req.params.subId);
    const { isCompleted, title } = req.body || {};

    const [existing] = await db
      .select()
      .from(subtasks)
      .where(and(eq(subtasks.id, subId), eq(subtasks.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Subtask not found.' });

    const [updated] = await db
      .update(subtasks)
      .set({
        isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : existing.isCompleted,
        title: title !== undefined ? String(title).trim() : existing.title,
      })
      .where(and(eq(subtasks.id, subId), eq(subtasks.userId, userId)))
      .returning();

    res.json({ subtask: updated });
  } catch (error) {
    console.error('PATCH /api/tasks/subtasks/:subId error:', error);
    res.status(500).json({ error: 'Failed to update subtask.' });
  }
});

router.delete('/subtasks/:subId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const subId = String(req.params.subId);
    await db
      .delete(subtasks)
      .where(and(eq(subtasks.id, subId), eq(subtasks.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/tasks/subtasks/:subId error:', error);
    res.status(500).json({ error: 'Failed to delete subtask.' });
  }
});

router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const { name, color = '#10b981' } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Category name is required.' });
    }
    const [created] = await db
      .insert(taskCategories)
      .values({ userId, name: String(name).trim(), color: String(color) })
      .returning();
    res.status(201).json({ category: created });
  } catch (error) {
    console.error('POST /api/tasks/categories error:', error);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

export default router;
