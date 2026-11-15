import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  streakHistory,
  taskCategories,
  userSettings,
  users,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null,
  avatarUrl?: string | null
) {
  try {
    const fallbackSlug = `dev-${uid.slice(0, 8).toLowerCase()}`;
    const resolvedName = displayName?.trim() || email.split('@')[0] || 'Developer';

    const [user] = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: resolvedName,
        avatarUrl: avatarUrl || null,
        portfolioSlug: fallbackSlug,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Ensure user_settings and streak_history exist idempotently
    await db
      .insert(userSettings)
      .values({ userId: user.id })
      .onConflictDoNothing({ target: userSettings.userId });

    await db
      .insert(streakHistory)
      .values({ userId: user.id })
      .onConflictDoNothing({ target: streakHistory.userId });

    const existingCats = await db
      .select()
      .from(taskCategories)
      .where(eq(taskCategories.userId, user.id));

    if (existingCats.length === 0) {
      await db.insert(taskCategories).values([
        { userId: user.id, name: 'Engineering', color: '#10b981' },
        { userId: user.id, name: 'Architecture', color: '#3b82f6' },
        { userId: user.id, name: 'Learning', color: '#8b5cf6' },
        { userId: user.id, name: 'Operations', color: '#f59e0b' },
      ]);
    }

    return user;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUserProfileBundle(userId: string) {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return null;

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    const categories = await db
      .select()
      .from(taskCategories)
      .where(eq(taskCategories.userId, userId));

    return { user, settings, categories };
  } catch (error) {
    console.error('Database query failed in getUserProfileBundle:', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}
