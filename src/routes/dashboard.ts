import { desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import {
  dailyProgress,
  githubContributions,
  journalEntries,
  learningGoals,
  learningSessions,
  projectMilestones,
  projects,
  subtasks,
  tasks,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getGitHubOverview } from '../services/githubService.ts';
import {
  getDateKeyInTimezone,
  getStreakDashboard,
  recalculateUserStreak,
  shiftDateKey,
} from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);

    const [allTasks, allProjects, allGoals, streakData, githubData] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.updatedAt)),
      db.select().from(projects).where(eq(projects.userId, userId)),
      db.select().from(learningGoals).where(eq(learningGoals.userId, userId)),
      getStreakDashboard(userId),
      getGitHubOverview(userId),
    ]);

    const totalTasks = allTasks.length;
    const completedToday = allTasks.filter((t) => {
      if (t.status !== 'Completed') return false;
      const d = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
      return getDateKeyInTimezone(d, tz) === todayKey;
    }).length;

    const pendingTasks = allTasks.filter(
      (t) => t.status === 'Pending' || t.status === 'In Progress'
    ).length;

    const overdueTasks = allTasks.filter(
      (t) =>
        t.status !== 'Completed' &&
        t.status !== 'Cancelled' &&
        Boolean(t.dueDate) &&
        (t.dueDate as string) < todayKey
    ).length;

    const activeProjects = allProjects.filter(
      (p) => p.status === 'In Progress' || p.status === 'Planning'
    ).length;

    const avgLearningProgress =
      allGoals.length > 0
        ? Math.round(allGoals.reduce((acc, g) => acc + g.progress, 0) / allGoals.length)
        : 0;

    // 7-day productivity series
    const historyMap = new Map(
      (streakData?.history || []).map((h) => [h.date, h])
    );
    const weeklySeries = [];
    for (let i = 6; i >= 0; i--) {
      const dateKey = shiftDateKey(todayKey, -i);
      const dayLabel = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'short',
      });
      const row = historyMap.get(dateKey);
      weeklySeries.push({
        date: dateKey,
        day: dayLabel,
        completed: row?.tasksCompleted || 0,
        commitments: row?.commitmentsCompleted || 0,
      });
    }

    // 14-day daily productivity trend
    const dailyProductivitySeries = [];
    for (let i = 13; i >= 0; i--) {
      const dateKey = shiftDateKey(todayKey, -i);
      const row = historyMap.get(dateKey);
      dailyProductivitySeries.push({
        date: dateKey.slice(5),
        tasks: row?.tasksCompleted || 0,
        commitments: row?.commitmentsCompleted || 0,
      });
    }

    // Upcoming deadlines (next 7 days)
    const upcomingDeadlines = allTasks
      .filter(
        (t) =>
          t.status !== 'Completed' &&
          t.status !== 'Cancelled' &&
          Boolean(t.dueDate)
      )
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 6);

    // Recent activities (tasks completed + recent projects + recent journal)
    const recentActivities = allTasks
      .slice(0, 8)
      .map((t) => ({
        id: t.id,
        type: t.status === 'Completed' ? 'task_completed' : 'task_updated',
        title: t.title,
        meta: `${t.categoryName} · ${t.priority}`,
        status: t.status,
        timestamp: t.updatedAt,
      }));

    res.json({
      todayKey,
      metrics: {
        totalTasks,
        completedToday,
        pendingTasks,
        overdueTasks,
        currentStreak: streakData?.summary.currentStreak || 0,
        longestStreak: streakData?.summary.longestStreak || 0,
        githubToday: githubData.stats.today,
        githubYear: githubData.stats.thisYear,
        githubConnected: githubData.connected,
        activeProjects,
        totalProjects: allProjects.length,
        avgLearningProgress,
        totalLearningGoals: allGoals.length,
      },
      weeklySeries,
      dailyProductivitySeries,
      githubSummary: githubData.stats,
      upcomingDeadlines,
      recentActivities,
    });
  } catch (error) {
    console.error('GET /api/dashboard/overview error:', error);
    res.status(500).json({ error: 'Failed to load dashboard overview.' });
  }
});

router.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const weekStartKey = shiftDateKey(todayKey, -6);
    const monthStartKey = shiftDateKey(todayKey, -29);

    const [
      allTasks,
      allProjects,
      allGoals,
      allSessions,
      progressRows,
      ghContribs,
      streakData,
    ] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.userId, userId)),
      db.select().from(projects).where(eq(projects.userId, userId)),
      db.select().from(learningGoals).where(eq(learningGoals.userId, userId)),
      db.select().from(learningSessions).where(eq(learningSessions.userId, userId)),
      db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId)),
      db.select().from(githubContributions).where(eq(githubContributions.userId, userId)),
      getStreakDashboard(userId),
    ]);

    const completedTasks = allTasks.filter((t) => t.status === 'Completed');
    const completionRate =
      allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    const timedTasks = completedTasks.filter((t) => t.actualMinutes || t.estimatedMinutes);
    const avgCompletionMinutes =
      timedTasks.length > 0
        ? Math.round(
            timedTasks.reduce(
              (acc, t) => acc + (t.actualMinutes || t.estimatedMinutes || 0),
              0
            ) / timedTasks.length
          )
        : 0;

    // Productivity by weekday & hour
    const weekdayCounts: Record<string, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };
    const hourCounts = new Array<number>(24).fill(0);

    for (const t of completedTasks) {
      const dt = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
      const dayName = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
      if (weekdayCounts[dayName] !== undefined) weekdayCounts[dayName] += 1;
      const hourStr = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tz,
      }).format(dt);
      const hr = Number(hourStr) % 24;
      hourCounts[hr] += 1;
    }

    const weekdaySeries = Object.entries(weekdayCounts).map(([day, count]) => ({
      day,
      count,
    }));
    const mostProductiveDay =
      [...weekdaySeries].sort((a, b) => b.count - a.count)[0]?.day || 'N/A';

    let peakHour = 0;
    let peakHourCount = 0;
    hourCounts.forEach((c, hr) => {
      if (c > peakHourCount) {
        peakHourCount = c;
        peakHour = hr;
      }
    });

    // 30-day trend combining tasks, learning minutes, and GitHub contributions
    const progressMap = new Map(progressRows.map((p) => [p.date, p]));
    const ghMap = new Map(ghContribs.map((c) => [c.date, c.count]));
    const sessionMinsByDate = new Map<string, number>();
    for (const s of allSessions) {
      sessionMinsByDate.set(
        s.sessionDate,
        (sessionMinsByDate.get(s.sessionDate) || 0) + s.durationMinutes
      );
    }

    const thirtyDayTrend = [];
    for (let i = 29; i >= 0; i--) {
      const dateKey = shiftDateKey(todayKey, -i);
      thirtyDayTrend.push({
        date: dateKey.slice(5),
        fullDate: dateKey,
        tasks: progressMap.get(dateKey)?.tasksCompleted || 0,
        commitments: progressMap.get(dateKey)?.commitmentsCompleted || 0,
        github: ghMap.get(dateKey) || 0,
        learningHours: Number(((sessionMinsByDate.get(dateKey) || 0) / 60).toFixed(1)),
      });
    }

    // Weekly summary report
    const accomplishedThisWeek = completedTasks.filter((t) => {
      const d = getDateKeyInTimezone(
        t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt),
        tz
      );
      return d >= weekStartKey && d <= todayKey;
    });

    const missedOrOpenThisWeek = allTasks.filter(
      (t) =>
        t.status !== 'Completed' &&
        t.status !== 'Cancelled' &&
        t.dueDate &&
        t.dueDate >= weekStartKey &&
        t.dueDate <= todayKey
    );

    const learningMinutesThisWeek = allSessions
      .filter((s) => s.sessionDate >= weekStartKey && s.sessionDate <= todayKey)
      .reduce((acc, s) => acc + s.durationMinutes, 0);

    const learningMinutesThisMonth = allSessions
      .filter((s) => s.sessionDate >= monthStartKey && s.sessionDate <= todayKey)
      .reduce((acc, s) => acc + s.durationMinutes, 0);

    const githubContribsThisWeek = ghContribs
      .filter((c) => c.date >= weekStartKey && c.date <= todayKey)
      .reduce((acc, c) => acc + c.count, 0);

    const projectStats = {
      total: allProjects.length,
      completed: allProjects.filter((p) => p.status === 'Completed').length,
      inProgress: allProjects.filter((p) => p.status === 'In Progress').length,
      planning: allProjects.filter((p) => p.status === 'Planning').length,
    };

    const areasToImprove: string[] = [];
    if (missedOrOpenThisWeek.length > 0) {
      areasToImprove.push(
        `${missedOrOpenThisWeek.length} scheduled task(s) from this week remain open.`
      );
    }
    if ((streakData?.weeklyConsistencyPct || 0) < 70) {
      areasToImprove.push(
        `Weekly daily-commitment consistency is ${streakData?.weeklyConsistencyPct || 0}%; aim for >= 70%.`
      );
    }
    if (learningMinutesThisWeek < 120) {
      areasToImprove.push(
        `Logged ${Math.round(learningMinutesThisWeek / 60 * 10) / 10}h of skill study this week; target 2+ hours.`
      );
    }
    if (areasToImprove.length === 0) {
      areasToImprove.push('Execution cadence is strong across tasks, commitments, and learning.');
    }

    res.json({
      summary: {
        totalTasks: allTasks.length,
        completedTasks: completedTasks.length,
        completionRate,
        avgCompletionMinutes,
        mostProductiveDay,
        mostProductiveHour: peakHourCount > 0 ? `${String(peakHour).padStart(2, '0')}:00` : 'N/A',
        weeklyConsistencyPct: streakData?.weeklyConsistencyPct || 0,
        monthlyConsistencyPct: streakData?.monthlyConsistencyPct || 0,
        learningHoursThisWeek: Number((learningMinutesThisWeek / 60).toFixed(1)),
        learningHoursThisMonth: Number((learningMinutesThisMonth / 60).toFixed(1)),
        projectStats,
      },
      weekdaySeries,
      thirtyDayTrend,
      weeklyReport: {
        periodStart: weekStartKey,
        periodEnd: todayKey,
        accomplished: accomplishedThisWeek.slice(0, 8),
        incomplete: missedOrOpenThisWeek.slice(0, 8),
        githubContributions: githubContribsThisWeek,
        learningHours: Number((learningMinutesThisWeek / 60).toFixed(1)),
        activeProjects: allProjects.filter((p) => p.status === 'In Progress').slice(0, 5),
        learningGoalsCount: allGoals.length,
        areasToImprove,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/analytics error:', error);
    res.status(500).json({ error: 'Failed to generate analytics report.' });
  }
});

router.post('/seed-starter', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const yesterdayKey = shiftDateKey(todayKey, -1);
    const twoDaysAgoKey = shiftDateKey(todayKey, -2);
    const tomorrowKey = shiftDateKey(todayKey, 1);

    const existingTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
    if (existingTasks.length > 0) {
      return res.json({ message: 'Workspace already contains data.' });
    }

    // Seed realistic engineering tasks & daily commitments
    const [t1, t2, t3, t4] = await db
      .insert(tasks)
      .values([
        {
          userId,
          title: 'Ship PostgreSQL Drizzle migration & API verification',
          description: 'Verify relational foreign keys and run schema check.',
          categoryName: 'Engineering',
          priority: 'High',
          status: 'Completed',
          isDailyCommitment: true,
          recurrence: 'Daily',
          startDate: twoDaysAgoKey,
          dueDate: twoDaysAgoKey,
          estimatedMinutes: 45,
          actualMinutes: 40,
          completedAt: new Date(`${twoDaysAgoKey}T14:30:00Z`),
        },
        {
          userId,
          title: 'Refactor streak calculation timezone boundary logic',
          description: 'Ensure daily commitments respect user configured IANA timezone.',
          categoryName: 'Architecture',
          priority: 'High',
          status: 'Completed',
          isDailyCommitment: true,
          recurrence: 'None',
          startDate: yesterdayKey,
          dueDate: yesterdayKey,
          estimatedMinutes: 60,
          actualMinutes: 55,
          completedAt: new Date(`${yesterdayKey}T16:15:00Z`),
        },
        {
          userId,
          title: 'Implement Recharts weekly velocity & consistency chart',
          description: 'Build responsive tooltip and tabular numerals.',
          categoryName: 'Engineering',
          priority: 'Urgent',
          status: 'In Progress',
          isDailyCommitment: true,
          recurrence: 'Daily',
          startDate: todayKey,
          dueDate: todayKey,
          estimatedMinutes: 45,
        },
        {
          userId,
          title: 'Document public portfolio case study & deployment steps',
          description: 'Add architecture notes, challenges, and live deployment link.',
          categoryName: 'Operations',
          priority: 'Medium',
          status: 'Pending',
          isDailyCommitment: false,
          recurrence: 'Weekly',
          startDate: todayKey,
          dueDate: tomorrowKey,
          estimatedMinutes: 30,
        },
      ])
      .returning();

    await db.insert(subtasks).values([
      { taskId: t3.id, userId, title: 'Configure responsive chart container', isCompleted: true, sortOrder: 0 },
      { taskId: t3.id, userId, title: 'Bind 7-day completion dataset', isCompleted: false, sortOrder: 1 },
      { taskId: t4.id, userId, title: 'Capture architecture diagram screenshot', isCompleted: false, sortOrder: 0 },
    ]);

    // Seed 2 starter portfolio projects using our generated local images
    const [p1] = await db
      .insert(projects)
      .values([
        {
          userId,
          name: 'Telemetry Stream Engine',
          slug: `telemetry-stream-${userId.slice(0, 6)}`,
          description:
            'High-throughput ingestion pipeline and PostgreSQL time-series aggregator for engineering metrics.',
          objectives: 'Sub-50ms p95 query latency across 1M+ daily events.',
          category: 'Backend & Infrastructure',
          status: 'In Progress',
          role: 'Lead Systems Engineer',
          githubUrl: 'https://github.com',
          coverImageUrl: '/src/assets/images/project_cover_telemetry_1794680297025.jpg',
          startDate: shiftDateKey(todayKey, -21),
          keyFeatures: [
            'Connection-pooled PostgreSQL writes',
            'Automated anomaly detection',
            'Zero-downtime schema migrations',
          ],
          challenges: 'Burst traffic caused connection pool exhaustion during peak deploy windows.',
          solutions: 'Implemented bounded batch buffering with backpressure and Drizzle prepared queries.',
          lessonsLearned: 'Measure pool wait times early before optimizing SQL indexes.',
          technologies: ['TypeScript', 'PostgreSQL', 'Node.js'],
          frameworks: ['Express', 'Drizzle ORM'],
          isPublic: true,
          progress: 50,
        },
        {
          userId,
          name: 'Focus Workspace CLI & Web',
          slug: `focus-workspace-${userId.slice(0, 6)}`,
          description:
            'Keyboard-first developer task and daily habit synchronization tool.',
          objectives: 'Eliminate context switching between terminal workflows and planning boards.',
          category: 'Developer Tools',
          status: 'Completed',
          role: 'Creator',
          coverImageUrl: '/src/assets/images/project_cover_workspace_1794680296872.jpg',
          startDate: shiftDateKey(todayKey, -60),
          completionDate: shiftDateKey(todayKey, -5),
          keyFeatures: ['Offline-first local cache', 'Git branch task binding', 'Markdown journal export'],
          technologies: ['TypeScript', 'React', 'Tailwind CSS'],
          frameworks: ['Vite', 'Recharts'],
          isPublic: true,
          progress: 100,
        },
      ])
      .returning();

    await db.insert(projectMilestones).values([
      {
        projectId: p1.id,
        userId,
        title: 'Core ingestion worker & PostgreSQL schema',
        isCompleted: true,
        dueDate: shiftDateKey(todayKey, -7),
        completedAt: new Date(),
      },
      {
        projectId: p1.id,
        userId,
        title: 'Production observability & load test benchmark',
        isCompleted: false,
        dueDate: shiftDateKey(todayKey, 7),
      },
    ]);

    // Seed Learning Goals & Sessions
    const [g1, g2] = await db
      .insert(learningGoals)
      .values([
        {
          userId,
          skillName: 'PostgreSQL',
          description: 'Query planner internals, partial indexes, and relational data modeling.',
          currentLevel: 'Intermediate',
          targetLevel: 'Advanced',
          startDate: shiftDateKey(todayKey, -14),
          targetDate: shiftDateKey(todayKey, 30),
          resources: [{ title: 'PostgreSQL Official Docs', url: 'https://www.postgresql.org/docs/' }],
          progress: 62,
          notes: 'Focus on EXPLAIN ANALYZE and composite B-tree index ordering.',
        },
        {
          userId,
          skillName: 'TypeScript',
          description: 'Advanced conditional types, inference, and strict end-to-end API contracts.',
          currentLevel: 'Advanced',
          targetLevel: 'Expert',
          startDate: shiftDateKey(todayKey, -30),
          targetDate: shiftDateKey(todayKey, 20),
          resources: [{ title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/' }],
          progress: 78,
        },
      ])
      .returning();

    await db.insert(learningSessions).values([
      {
        goalId: g1.id,
        userId,
        topic: 'Composite B-Tree Indexes & Covering Queries',
        durationMinutes: 60,
        takeaways: 'Put equality columns first and range/sort columns second in composite indexes.',
        sessionDate: yesterdayKey,
      },
      {
        goalId: g2.id,
        userId,
        topic: 'Discriminated Unions for API Error Handling',
        durationMinutes: 45,
        takeaways: 'Exhaustive switch checks catch unhandled response states at compile time.',
        sessionDate: todayKey,
      },
    ]);

    // Seed 1 Journal entry linked to project & goal
    await db.insert(journalEntries).values({
      userId,
      title: 'Establishing a consistent engineering cadence',
      entryDate: todayKey,
      reflections: 'Separating daily commitments from nice-to-have backlog tasks keeps focus sharp.',
      learnedToday: 'Drizzle ORM relational queries with explicit partial indexes.',
      challenges: 'Keeping sprint scope realistic while building portfolio case studies.',
      improvements: 'Timebox exploratory spikes to 45 minutes.',
      projectIdeas: 'Build an automated changelog generator from merged PR labels.',
      achievementsText: 'Maintained consecutive commitment streak across architecture refactors.',
      linkedTaskId: t1.id,
      linkedProjectId: p1.id,
      linkedGoalId: g1.id,
    });

    await recalculateUserStreak(userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/dashboard/seed-starter error:', error);
    res.status(500).json({ error: 'Failed to seed starter workspace.' });
  }
});

export default router;
