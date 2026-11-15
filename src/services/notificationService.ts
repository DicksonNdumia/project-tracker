import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { notifications, tasks, userSettings, users } from '../db/schema.ts';
import { getDateKeyInTimezone, shiftDateKey } from './streakService.ts';

export async function generateSmartNotifications(userId: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return [];

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    const tz = user.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const tomorrowKey = shiftDateKey(todayKey, 1);

    const activeTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId)));

    const existingNotifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    const existingTitlesToday = new Set(
      existingNotifs
        .filter((n) => getDateKeyInTimezone(new Date(n.createdAt), tz) === todayKey)
        .map((n) => n.title)
    );

    const toInsert: Array<{
      userId: string;
      type: string;
      title: string;
      message: string;
      linkTab: string;
    }> = [];

    const openTasks = activeTasks.filter(
      (t) => t.status !== 'Completed' && t.status !== 'Cancelled'
    );

    if (settings?.deadlineAlerts !== false) {
      const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < todayKey);
      if (overdue.length > 0) {
        const title = `Overdue Tasks (${overdue.length})`;
        if (!existingTitlesToday.has(title)) {
          toInsert.push({
            userId,
            type: 'overdue',
            title,
            message: `${overdue[0].title}${overdue.length > 1 ? ` and ${overdue.length - 1} more` : ''} passed due date.`,
            linkTab: 'tasks',
          });
        }
      }

      const upcoming = openTasks.filter(
        (t) => t.dueDate && (t.dueDate === todayKey || t.dueDate === tomorrowKey)
      );
      if (upcoming.length > 0) {
        const title = `Upcoming Deadlines (${upcoming.length})`;
        if (!existingTitlesToday.has(title)) {
          toInsert.push({
            userId,
            type: 'deadline',
            title,
            message: `Due soon: ${upcoming[0].title}${upcoming.length > 1 ? ` (+${upcoming.length - 1} more)` : ''}.`,
            linkTab: 'tasks',
          });
        }
      }
    }

    if (settings?.streakReminders !== false) {
      const commitmentsPending = openTasks.filter(
        (t) => t.isDailyCommitment && (!t.dueDate || t.dueDate <= todayKey)
      );
      if (commitmentsPending.length > 0) {
        const title = 'Daily Commitment Reminder';
        if (!existingTitlesToday.has(title)) {
          toInsert.push({
            userId,
            type: 'reminder',
            title,
            message: `Complete ${user.dailyCommitmentTarget} daily commitment task(s) today to protect your streak.`,
            linkTab: 'streaks',
          });
        }
      }
    }

    if (toInsert.length > 0) {
      await db.insert(notifications).values(toInsert);
    }

    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  } catch (error) {
    console.error('Database query failed in generateSmartNotifications:', error);
    throw new Error('Failed to load notifications.', { cause: error });
  }
}
