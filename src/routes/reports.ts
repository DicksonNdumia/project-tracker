import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import {
  focusSessions,
  githubContributions,
  learningSessions,
  projectMilestones,
  projects,
  streakHistory,
  tasks,
  weeklyReports,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  getDateKeyInTimezone,
  getStreakDashboard,
  shiftDateKey,
} from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

function getMondayOfWeek(dateKey: string): string {
  const dt = new Date(`${dateKey}T12:00:00Z`);
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diffToMon);
  return dt.toISOString().slice(0, 10);
}

async function generateAndPersistWeeklyReport(
  userId: string,
  tz: string,
  requestedWeekStart?: string
) {
  const todayKey = getDateKeyInTimezone(new Date(), tz);
  const weekStart =
    requestedWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeekStart)
      ? getMondayOfWeek(requestedWeekStart)
      : getMondayOfWeek(todayKey);
  const weekEnd = shiftDateKey(weekStart, 6);

  const [
    allTasks,
    streakInfo,
    ghContribs,
    allFocus,
    allLearning,
    allMilestones,
    allProjects,
  ] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    getStreakDashboard(userId),
    db.select().from(githubContributions).where(eq(githubContributions.userId, userId)),
    db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
    db.select().from(learningSessions).where(eq(learningSessions.userId, userId)),
    db.select().from(projectMilestones).where(eq(projectMilestones.userId, userId)),
    db.select().from(projects).where(eq(projects.userId, userId)),
  ]);

  const plannedTasks = allTasks.filter((t) => {
    const refDate = t.dueDate || t.startDate || getDateKeyInTimezone(new Date(t.createdAt), tz);
    return refDate >= weekStart && refDate <= weekEnd && t.status !== 'Cancelled';
  });

  const completedTasksInWeek = allTasks.filter((t) => {
    if (t.status !== 'Completed') return false;
    const compDate = getDateKeyInTimezone(
      t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt),
      tz
    );
    return compDate >= weekStart && compDate <= weekEnd;
  });

  const tasksPlannedCount = Math.max(plannedTasks.length, completedTasksInWeek.length);
  const completionPct =
    tasksPlannedCount > 0
      ? Math.min(100, Math.round((completedTasksInWeek.length / tasksPlannedCount) * 100))
      : 0;

  const githubCount = ghContribs
    .filter((c) => c.date >= weekStart && c.date <= weekEnd)
    .reduce((acc, c) => acc + c.count, 0);

  const focusSeconds = allFocus
    .filter(
      (f) =>
        f.mode === 'focus' &&
        f.status === 'completed' &&
        f.sessionDate >= weekStart &&
        f.sessionDate <= weekEnd
    )
    .reduce((acc, f) => acc + f.actualSeconds, 0);
  const focusHours = (focusSeconds / 3600).toFixed(1);

  const learningMinutes = allLearning
    .filter((s) => s.sessionDate >= weekStart && s.sessionDate <= weekEnd)
    .reduce((acc, s) => acc + s.durationMinutes, 0);
  const learningHours = (learningMinutes / 60).toFixed(1);

  const completedMilestones = allMilestones.filter((m) => {
    if (!m.isCompleted || !m.completedAt) return false;
    const d = getDateKeyInTimezone(new Date(m.completedAt), tz);
    return d >= weekStart && d <= weekEnd;
  });

  const projectNameById = new Map(allProjects.map((p) => [p.id, p.name]));

  const improvementAreas: string[] = [];
  if (tasksPlannedCount > 0 && completionPct < 75) {
    improvementAreas.push(
      `Task completion was ${completionPct}% (${completedTasksInWeek.length}/${tasksPlannedCount}); scope daily plans tighter.`
    );
  }
  if (Number(focusHours) < 2) {
    improvementAreas.push(
      `Logged ${focusHours}h in Focus Mode; schedule at least 2 hours of distraction-free deep work.`
    );
  }
  if (Number(learningHours) < 2) {
    improvementAreas.push(
      `Recorded ${learningHours}h of deliberate learning; target 2+ hours weekly skill practice.`
    );
  }
  if ((streakInfo?.summary.currentStreak || 0) === 0) {
    improvementAreas.push('Re-establish your daily streak commitment with 1 focused commitment today.');
  }
  if (improvementAreas.length === 0) {
    improvementAreas.push('Balanced execution across tasks, deep focus, learning, and shipping.');
  }

  const reportData = {
    accomplishedTasks: completedTasksInWeek.slice(0, 15).map((t) => ({
      id: t.id,
      title: t.title,
      categoryName: t.categoryName,
      priority: t.priority,
    })),
    unfinishedTasks: plannedTasks
      .filter((t) => t.status !== 'Completed')
      .slice(0, 15)
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
    milestones: completedMilestones.map((m) => ({
      id: m.id,
      title: m.title,
      projectName: projectNameById.get(m.projectId) || 'Project',
    })),
  };

  const [saved] = await db
    .insert(weeklyReports)
    .values({
      userId,
      weekStart,
      weekEnd,
      tasksPlanned: tasksPlannedCount,
      tasksCompleted: completedTasksInWeek.length,
      completionPct,
      currentStreak: streakInfo?.summary.currentStreak || 0,
      longestStreak: streakInfo?.summary.longestStreak || 0,
      githubContributions: githubCount,
      focusHours,
      learningHours,
      milestonesCompleted: completedMilestones.length,
      improvementAreas,
      reportData,
    })
    .onConflictDoUpdate({
      target: [weeklyReports.userId, weeklyReports.weekStart],
      set: {
        weekEnd,
        tasksPlanned: tasksPlannedCount,
        tasksCompleted: completedTasksInWeek.length,
        completionPct,
        currentStreak: streakInfo?.summary.currentStreak || 0,
        longestStreak: streakInfo?.summary.longestStreak || 0,
        githubContributions: githubCount,
        focusHours,
        learningHours,
        milestonesCompleted: completedMilestones.length,
        improvementAreas,
        reportData,
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved;
}

router.get('/weekly/history', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const currentMonday = getMondayOfWeek(todayKey);

    // Ensure current week and prior 3 weeks are materialized for seamless browsing
    const recentMondays = [0, -7, -14, -21].map((offset) => shiftDateKey(currentMonday, offset));
    for (const mon of recentMondays) {
      await generateAndPersistWeeklyReport(userId, tz, mon);
    }

    const history = await db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.userId, userId))
      .orderBy(desc(weeklyReports.weekStart));

    res.json({ reports: history });
  } catch (error) {
    console.error('GET /api/reports/weekly/history error:', error);
    res.status(500).json({ error: 'Failed to load weekly performance reports.' });
  }
});

router.get('/weekly', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : undefined;
    const report = await generateAndPersistWeeklyReport(userId, tz, weekStart);
    res.json({ report });
  } catch (error) {
    console.error('GET /api/reports/weekly error:', error);
    res.status(500).json({ error: 'Failed to generate weekly report.' });
  }
});

export default router;
