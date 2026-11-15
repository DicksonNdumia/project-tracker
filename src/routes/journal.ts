import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import { journalEntries } from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const entries = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt));

    res.json({ entries });
  } catch (error) {
    console.error('GET /api/journal error:', error);
    res.status(500).json({ error: 'Failed to load journal entries.' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ error: 'Journal entry title is required.' });
    }

    const [created] = await db
      .insert(journalEntries)
      .values({
        userId,
        title: String(b.title).trim(),
        entryDate: b.entryDate || new Date().toISOString().slice(0, 10),
        reflections: String(b.reflections || ''),
        learnedToday: String(b.learnedToday || ''),
        challenges: String(b.challenges || ''),
        improvements: String(b.improvements || ''),
        projectIdeas: String(b.projectIdeas || ''),
        achievementsText: String(b.achievementsText || ''),
        linkedTaskId: b.linkedTaskId || null,
        linkedProjectId: b.linkedProjectId || null,
        linkedGoalId: b.linkedGoalId || null,
      })
      .returning();

    res.status(201).json({ entry: created });
  } catch (error) {
    console.error('POST /api/journal error:', error);
    res.status(500).json({ error: 'Failed to create journal entry.' });
  }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const entryId = String(req.params.id);
    const [existing] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, entryId), eq(journalEntries.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Journal entry not found.' });

    const b = req.body || {};
    const [updated] = await db
      .update(journalEntries)
      .set({
        title: b.title !== undefined ? String(b.title).trim() : existing.title,
        entryDate: b.entryDate !== undefined ? String(b.entryDate) : existing.entryDate,
        reflections: b.reflections !== undefined ? String(b.reflections) : existing.reflections,
        learnedToday:
          b.learnedToday !== undefined ? String(b.learnedToday) : existing.learnedToday,
        challenges: b.challenges !== undefined ? String(b.challenges) : existing.challenges,
        improvements:
          b.improvements !== undefined ? String(b.improvements) : existing.improvements,
        projectIdeas:
          b.projectIdeas !== undefined ? String(b.projectIdeas) : existing.projectIdeas,
        achievementsText:
          b.achievementsText !== undefined
            ? String(b.achievementsText)
            : existing.achievementsText,
        linkedTaskId: b.linkedTaskId !== undefined ? b.linkedTaskId || null : existing.linkedTaskId,
        linkedProjectId:
          b.linkedProjectId !== undefined ? b.linkedProjectId || null : existing.linkedProjectId,
        linkedGoalId: b.linkedGoalId !== undefined ? b.linkedGoalId || null : existing.linkedGoalId,
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, entryId))
      .returning();

    res.json({ entry: updated });
  } catch (error) {
    console.error('PATCH /api/journal/:id error:', error);
    res.status(500).json({ error: 'Failed to update journal entry.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const entryId = String(req.params.id);
    await db
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, entryId), eq(journalEntries.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/journal/:id error:', error);
    res.status(500).json({ error: 'Failed to delete journal entry.' });
  }
});

export default router;
