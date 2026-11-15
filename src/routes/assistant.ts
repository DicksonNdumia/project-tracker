import { GoogleGenAI } from '@google/genai';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import {
  focusSessions,
  learningGoals,
  projects,
  streakHistory,
  tasks,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getDateKeyInTimezone } from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

const ROLE_INSTRUCTIONS: Record<string, string> = {
  productivity:
    'You are an engineering productivity coach embedded inside Progress Tracker. Be concise, practical, and specific. Help the user prioritize daily MITs, structure Pomodoro focus blocks, overcome procrastination, and protect their daily streak.',
  interview:
    'You are a senior staff software engineer acting as a technical interview mentor inside Progress Tracker. Help the user practice data structures, system design trade-offs, behavioral STAR stories, and targeted improvement plans.',
  architect:
    'You are a pragmatic principal software architect inside Progress Tracker. Help the user break software projects into realistic milestones, releases, task dependencies, and clear technical decisions.',
};

router.post('/chat', async (req: AuthRequest, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const { message, history = [], role = 'productivity', fastMode = false } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);

    const [allTasks, allProjects, allGoals, allFocus, streakRows] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.userId, userId)),
      db.select().from(projects).where(eq(projects.userId, userId)),
      db.select().from(learningGoals).where(eq(learningGoals.userId, userId)),
      db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
      db.select().from(streakHistory).where(eq(streakHistory.userId, userId)),
    ]);

    const openTasks = allTasks.filter((t) => t.status === 'Pending' || t.status === 'In Progress');
    const overdueTasks = openTasks.filter((t) => Boolean(t.dueDate && t.dueDate < todayKey));
    const focusTodayMinutes = Math.round(
      allFocus
        .filter((f) => f.mode === 'focus' && f.status === 'completed' && f.sessionDate === todayKey)
        .reduce((acc, f) => acc + f.actualSeconds, 0) / 60
    );

    const workspaceContext = [
      `Live workspace snapshot (${todayKey}, timezone ${tz}):`,
      `- Current streak: ${streakRows[0]?.currentStreak || 0} days (longest ${streakRows[0]?.longestStreak || 0} days)`,
      `- Open tasks: ${openTasks.length} (${overdueTasks.length} overdue)`,
      `- Top open tasks: ${openTasks
        .slice(0, 5)
        .map((t) => `"${t.title}" [${t.priority}${t.dueDate ? `, due ${t.dueDate}` : ''}]`)
        .join('; ') || 'None'}`,
      `- Active projects: ${allProjects
        .filter((p) => p.status === 'In Progress' || p.status === 'Planning')
        .slice(0, 4)
        .map((p) => `${p.name} (${p.progress}%)`)
        .join('; ') || 'None'}`,
      `- Learning goals: ${allGoals
        .slice(0, 4)
        .map((g) => `${g.skillName} (${g.progress}%)`)
        .join('; ') || 'None'}`,
      `- Focus minutes logged today: ${focusTodayMinutes}m`,
    ].join('\n');

    const baseRoleInstruction = ROLE_INSTRUCTIONS[String(role)] || ROLE_INSTRUCTIONS.productivity;
    const systemInstruction = `${baseRoleInstruction}\n\n${workspaceContext}`;

    const model = fastMode ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

    const sanitizedHistory = Array.isArray(history)
      ? history
          .filter(
            (h: unknown): h is { role: 'user' | 'model'; text: string } =>
              Boolean(h) &&
              typeof h === 'object' &&
              ((h as { role?: string }).role === 'user' ||
                (h as { role?: string }).role === 'model') &&
              typeof (h as { text?: string }).text === 'string' &&
              (h as { text: string }).text.trim().length > 0
          )
          .slice(-20)
          .map((h) => ({
            role: h.role,
            parts: [{ text: h.text }],
          }))
      : [];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction,
      },
      history: sanitizedHistory,
    });

    const response = await chat.sendMessage({ message: message.trim() });
    const reply = response.text || 'I could not generate a response right now.';

    res.json({ reply, model });
  } catch (error: unknown) {
    console.error('POST /api/assistant/chat error:', error);
    const msg = error instanceof Error ? error.message : 'Assistant request failed.';
    res.status(500).json({ error: msg });
  }
});

export default router;
