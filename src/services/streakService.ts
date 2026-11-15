import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  achievements,
  dailyProgress,
  notifications,
  streakHistory,
  tasks,
  users,
} from '../db/schema.ts';

export const STREAK_MILESTONES = [
  {
    days: 3,
    code: 'STREAK_3',
    title: 'Ignition: 3-Day Streak',
    description: 'Completed daily commitments for 3 consecutive days.',
  },
  {
    days: 7,
    code: 'STREAK_7',
    title: 'Momentum: 7-Day Streak',
    description: 'Maintained a full week of daily engineering consistency.',
  },
  {
    days: 14,
    code: 'STREAK_14',
    title: 'Cadence: 14-Day Streak',
    description: 'Two consecutive weeks of hitting your daily commitment target.',
  },
  {
    days: 30,
    code: 'STREAK_30',
    title: 'Discipline: 30-Day Streak',
    description: 'A full month of uninterrupted daily commitment execution.',
  },
  {
    days: 100,
    code: 'STREAK_100',
    title: 'Centurion: 100-Day Streak',
    description: '100 consecutive days of verified daily commitment delivery.',
  },
];

export function getDateKeyInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export async function recalculateUserStreak(userId: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return null;

    const tz = user.timezone || 'UTC';
    const target = Math.max(1, user.dailyCommitmentTarget || 1);
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const yesterdayKey = shiftDateKey(todayKey, -1);

    const completedTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'Completed')));

    const existingRows = await db
      .select()
      .from(dailyProgress)
      .where(eq(dailyProgress.userId, userId));

    const existingMap = new Map(existingRows.map((row) => [row.date, row]));
    const taskCountsByDate = new Map<
      string,
      { tasksCompleted: number; commitmentsCompleted: number }
    >();

    for (const task of completedTasks) {
      const refDate = task.completedAt ? new Date(task.completedAt) : new Date(task.updatedAt);
      const dateKey = getDateKeyInTimezone(refDate, tz);
      const entry = taskCountsByDate.get(dateKey) || {
        tasksCompleted: 0,
        commitmentsCompleted: 0,
      };
      entry.tasksCompleted += 1;
      if (task.isDailyCommitment) {
        entry.commitmentsCompleted += 1;
      }
      taskCountsByDate.set(dateKey, entry);
    }

    // Union of dates so historical active days remain preserved
    const allDates = new Set<string>([
      ...existingMap.keys(),
      ...taskCountsByDate.keys(),
      todayKey,
    ]);

    const mergedByDate = new Map<
      string,
      {
        commitmentsCompleted: number;
        commitmentsTarget: number;
        tasksCompleted: number;
        isSuccess: boolean;
      }
    >();

    for (const dateKey of allDates) {
      const taskStats = taskCountsByDate.get(dateKey);
      const prevRow = existingMap.get(dateKey);

      const tasksCompleted = taskStats
        ? taskStats.tasksCompleted
        : prevRow?.tasksCompleted || 0;
      const commitmentsCompleted = taskStats
        ? taskStats.commitmentsCompleted
        : prevRow?.commitmentsCompleted || 0;

      // For today, always evaluate against user's current dailyCommitmentTarget;
      // for past days preserve historical target if already logged as successful.
      const dayTarget =
        dateKey === todayKey ? target : prevRow?.commitmentsTarget || target;
      const isSuccess = commitmentsCompleted >= dayTarget;

      mergedByDate.set(dateKey, {
        commitmentsCompleted,
        commitmentsTarget: dayTarget,
        tasksCompleted,
        isSuccess,
      });

      if (taskStats || prevRow || dateKey === todayKey) {
        await db
          .insert(dailyProgress)
          .values({
            userId,
            date: dateKey,
            commitmentsCompleted,
            commitmentsTarget: dayTarget,
            tasksCompleted,
            isSuccess,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [dailyProgress.userId, dailyProgress.date],
            set: {
              commitmentsCompleted,
              commitmentsTarget: dayTarget,
              tasksCompleted,
              isSuccess,
              updatedAt: new Date(),
            },
          });
      }
    }

    // Compute longest streak, total active days, and current streak
    const successDates = Array.from(mergedByDate.entries())
      .filter(([, val]) => val.isSuccess)
      .map(([date]) => date)
      .sort();

    const successSet = new Set(successDates);
    const totalActiveDays = successDates.length;
    const lastActiveDate =
      successDates.length > 0 ? successDates[successDates.length - 1] : null;

    let longestStreak = 0;
    let running = 0;
    let prevDate: string | null = null;
    for (const dateKey of successDates) {
      if (prevDate && shiftDateKey(prevDate, 1) === dateKey) {
        running += 1;
      } else {
        running = 1;
      }
      if (running > longestStreak) longestStreak = running;
      prevDate = dateKey;
    }

    // Current streak: active if today or yesterday is successful
    let currentStreak = 0;
    let cursor: string | null = successSet.has(todayKey)
      ? todayKey
      : successSet.has(yesterdayKey)
        ? yesterdayKey
        : null;

    while (cursor && successSet.has(cursor)) {
      currentStreak += 1;
      cursor = shiftDateKey(cursor, -1);
    }

    const [updatedStreak] = await db
      .insert(streakHistory)
      .values({
        userId,
        currentStreak,
        longestStreak,
        totalActiveDays,
        lastActiveDate,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: streakHistory.userId,
        set: {
          currentStreak,
          longestStreak,
          totalActiveDays,
          lastActiveDate,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Check & unlock milestone achievements
    for (const milestone of STREAK_MILESTONES) {
      if (longestStreak >= milestone.days || currentStreak >= milestone.days) {
        const inserted = await db
          .insert(achievements)
          .values({
            userId,
            code: milestone.code,
            title: milestone.title,
            description: milestone.description,
            milestoneDays: milestone.days,
          })
          .onConflictDoNothing({
            target: [achievements.userId, achievements.code],
          })
          .returning();

        if (inserted.length > 0) {
          await db.insert(notifications).values({
            userId,
            type: 'streak',
            title: `Milestone Unlocked: ${milestone.title}`,
            message: milestone.description,
            linkTab: 'streaks',
          });
        }
      }
    }

    return updatedStreak;
  } catch (error) {
    console.error('Database query failed in recalculateUserStreak:', error);
    throw new Error('Failed to recalculate streak history.', { cause: error });
  }
}

export async function getStreakDashboard(userId: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return null;

    const tz = user.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);

    const summary = await recalculateUserStreak(userId);
    const history = await db
      .select()
      .from(dailyProgress)
      .where(eq(dailyProgress.userId, userId))
      .orderBy(desc(dailyProgress.date));

    const unlocked = await db
      .select()
      .from(achievements)
      .where(eq(achievements.userId, userId))
      .orderBy(achievements.milestoneDays);

    const historyMap = new Map(history.map((h) => [h.date, h]));

    // Weekly (last 7 days) and Monthly (last 30 days) consistency %
    let weeklySuccess = 0;
    for (let i = 0; i < 7; i++) {
      const k = shiftDateKey(todayKey, -i);
      if (historyMap.get(k)?.isSuccess) weeklySuccess += 1;
    }

    let monthlySuccess = 0;
    for (let i = 0; i < 30; i++) {
      const k = shiftDateKey(todayKey, -i);
      if (historyMap.get(k)?.isSuccess) monthlySuccess += 1;
    }

    const todayProgress = historyMap.get(todayKey) || {
      date: todayKey,
      commitmentsCompleted: 0,
      commitmentsTarget: user.dailyCommitmentTarget || 1,
      tasksCompleted: 0,
      isSuccess: false,
    };

    return {
      summary: summary || {
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        lastActiveDate: null,
      },
      todayKey,
      todayProgress,
      weeklyConsistencyPct: Math.round((weeklySuccess / 7) * 100),
      monthlyConsistencyPct: Math.round((monthlySuccess / 30) * 100),
      dailyTarget: user.dailyCommitmentTarget || 1,
      timezone: tz,
      history,
      achievements: unlocked,
    };
  } catch (error) {
    console.error('Database query failed in getStreakDashboard:', error);
    throw new Error('Failed to load streak analytics.', { cause: error });
  }
}
