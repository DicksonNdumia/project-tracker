import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import {
  careerMilestones,
  certifications,
  interviewPrep,
  jobApplications,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getDateKeyInTimezone } from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [applications, prepRecords, certs, milestones] = await Promise.all([
      db
        .select()
        .from(jobApplications)
        .where(eq(jobApplications.userId, userId))
        .orderBy(desc(jobApplications.updatedAt)),
      db
        .select()
        .from(interviewPrep)
        .where(eq(interviewPrep.userId, userId))
        .orderBy(desc(interviewPrep.practiceDate), desc(interviewPrep.createdAt)),
      db
        .select()
        .from(certifications)
        .where(eq(certifications.userId, userId))
        .orderBy(desc(certifications.createdAt)),
      db
        .select()
        .from(careerMilestones)
        .where(eq(careerMilestones.userId, userId))
        .orderBy(asc(careerMilestones.isCompleted), asc(careerMilestones.targetDate)),
    ]);

    res.json({
      applications,
      prepRecords,
      certifications: certs,
      milestones,
    });
  } catch (error) {
    console.error('GET /api/career error:', error);
    res.status(500).json({ error: 'Failed to load career development records.' });
  }
});

// Job Applications
router.post('/applications', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};
    if (!b.company || !String(b.company).trim() || !b.roleTitle || !String(b.roleTitle).trim()) {
      return res.status(400).json({ error: 'Company and role title are required.' });
    }
    const [created] = await db
      .insert(jobApplications)
      .values({
        userId,
        company: String(b.company).trim(),
        roleTitle: String(b.roleTitle).trim(),
        status: String(b.status || 'Applied'),
        appliedDate: b.appliedDate || null,
        salaryRange: String(b.salaryRange || ''),
        location: String(b.location || 'Remote'),
        jobUrl: String(b.jobUrl || ''),
        notes: String(b.notes || ''),
      })
      .returning();
    res.status(201).json({ application: created });
  } catch (error) {
    console.error('POST /api/career/applications error:', error);
    res.status(500).json({ error: 'Failed to create job application.' });
  }
});

router.patch('/applications/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    const [existing] = await db
      .select()
      .from(jobApplications)
      .where(and(eq(jobApplications.id, id), eq(jobApplications.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Application not found.' });

    const b = req.body || {};
    const [updated] = await db
      .update(jobApplications)
      .set({
        company: b.company !== undefined ? String(b.company).trim() : existing.company,
        roleTitle: b.roleTitle !== undefined ? String(b.roleTitle).trim() : existing.roleTitle,
        status: b.status !== undefined ? String(b.status) : existing.status,
        appliedDate: b.appliedDate !== undefined ? b.appliedDate : existing.appliedDate,
        salaryRange: b.salaryRange !== undefined ? String(b.salaryRange) : existing.salaryRange,
        location: b.location !== undefined ? String(b.location) : existing.location,
        jobUrl: b.jobUrl !== undefined ? String(b.jobUrl) : existing.jobUrl,
        notes: b.notes !== undefined ? String(b.notes) : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(jobApplications.id, id))
      .returning();
    res.json({ application: updated });
  } catch (error) {
    console.error('PATCH /api/career/applications/:id error:', error);
    res.status(500).json({ error: 'Failed to update job application.' });
  }
});

router.delete('/applications/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    await db
      .delete(jobApplications)
      .where(and(eq(jobApplications.id, id), eq(jobApplications.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/career/applications/:id error:', error);
    res.status(500).json({ error: 'Failed to delete job application.' });
  }
});

// Interview Prep & Practice
router.post('/prep', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const tz = req.dbUser!.timezone || 'UTC';
    const todayKey = getDateKeyInTimezone(new Date(), tz);
    const b = req.body || {};
    if (!b.topic || !String(b.topic).trim()) {
      return res.status(400).json({ error: 'Practice topic is required.' });
    }
    const [created] = await db
      .insert(interviewPrep)
      .values({
        userId,
        applicationId: b.applicationId ? String(b.applicationId) : null,
        company: String(b.company || 'General'),
        topic: String(b.topic).trim(),
        category: String(b.category || 'DSA'),
        difficulty: String(b.difficulty || 'Medium'),
        status: String(b.status || 'Practiced'),
        practiceDate: b.practiceDate || todayKey,
        durationMinutes: Math.max(5, Number(b.durationMinutes) || 45),
        feedback: String(b.feedback || ''),
        improvementNotes: String(b.improvementNotes || ''),
      })
      .returning();
    res.status(201).json({ prep: created });
  } catch (error) {
    console.error('POST /api/career/prep error:', error);
    res.status(500).json({ error: 'Failed to log interview prep.' });
  }
});

router.patch('/prep/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    const [existing] = await db
      .select()
      .from(interviewPrep)
      .where(and(eq(interviewPrep.id, id), eq(interviewPrep.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Record not found.' });

    const b = req.body || {};
    const [updated] = await db
      .update(interviewPrep)
      .set({
        company: b.company !== undefined ? String(b.company) : existing.company,
        topic: b.topic !== undefined ? String(b.topic).trim() : existing.topic,
        category: b.category !== undefined ? String(b.category) : existing.category,
        difficulty: b.difficulty !== undefined ? String(b.difficulty) : existing.difficulty,
        status: b.status !== undefined ? String(b.status) : existing.status,
        practiceDate: b.practiceDate !== undefined ? String(b.practiceDate) : existing.practiceDate,
        durationMinutes:
          b.durationMinutes !== undefined
            ? Number(b.durationMinutes)
            : existing.durationMinutes,
        feedback: b.feedback !== undefined ? String(b.feedback) : existing.feedback,
        improvementNotes:
          b.improvementNotes !== undefined
            ? String(b.improvementNotes)
            : existing.improvementNotes,
      })
      .where(eq(interviewPrep.id, id))
      .returning();
    res.json({ prep: updated });
  } catch (error) {
    console.error('PATCH /api/career/prep/:id error:', error);
    res.status(500).json({ error: 'Failed to update interview prep record.' });
  }
});

router.delete('/prep/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    await db
      .delete(interviewPrep)
      .where(and(eq(interviewPrep.id, id), eq(interviewPrep.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/career/prep/:id error:', error);
    res.status(500).json({ error: 'Failed to delete interview prep record.' });
  }
});

// Certifications
router.post('/certifications', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};
    if (!b.name || !String(b.name).trim() || !b.issuer || !String(b.issuer).trim()) {
      return res.status(400).json({ error: 'Certification name and issuer are required.' });
    }
    const [created] = await db
      .insert(certifications)
      .values({
        userId,
        name: String(b.name).trim(),
        issuer: String(b.issuer).trim(),
        status: String(b.status || 'In Progress'),
        earnedDate: b.earnedDate || null,
        expiryDate: b.expiryDate || null,
        credentialId: String(b.credentialId || ''),
        credentialUrl: String(b.credentialUrl || ''),
        notes: String(b.notes || ''),
      })
      .returning();
    res.status(201).json({ certification: created });
  } catch (error) {
    console.error('POST /api/career/certifications error:', error);
    res.status(500).json({ error: 'Failed to add certification.' });
  }
});

router.patch('/certifications/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    const [existing] = await db
      .select()
      .from(certifications)
      .where(and(eq(certifications.id, id), eq(certifications.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Certification not found.' });

    const b = req.body || {};
    const [updated] = await db
      .update(certifications)
      .set({
        name: b.name !== undefined ? String(b.name).trim() : existing.name,
        issuer: b.issuer !== undefined ? String(b.issuer).trim() : existing.issuer,
        status: b.status !== undefined ? String(b.status) : existing.status,
        earnedDate: b.earnedDate !== undefined ? b.earnedDate : existing.earnedDate,
        expiryDate: b.expiryDate !== undefined ? b.expiryDate : existing.expiryDate,
        credentialId: b.credentialId !== undefined ? String(b.credentialId) : existing.credentialId,
        credentialUrl:
          b.credentialUrl !== undefined ? String(b.credentialUrl) : existing.credentialUrl,
        notes: b.notes !== undefined ? String(b.notes) : existing.notes,
      })
      .where(eq(certifications.id, id))
      .returning();
    res.json({ certification: updated });
  } catch (error) {
    console.error('PATCH /api/career/certifications/:id error:', error);
    res.status(500).json({ error: 'Failed to update certification.' });
  }
});

router.delete('/certifications/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    await db
      .delete(certifications)
      .where(and(eq(certifications.id, id), eq(certifications.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/career/certifications/:id error:', error);
    res.status(500).json({ error: 'Failed to delete certification.' });
  }
});

// Career Milestones
router.post('/milestones', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};
    if (!b.title || !String(b.title).trim()) {
      return res.status(400).json({ error: 'Milestone title is required.' });
    }
    const [created] = await db
      .insert(careerMilestones)
      .values({
        userId,
        title: String(b.title).trim(),
        targetDate: b.targetDate || null,
        notes: String(b.notes || ''),
      })
      .returning();
    res.status(201).json({ milestone: created });
  } catch (error) {
    console.error('POST /api/career/milestones error:', error);
    res.status(500).json({ error: 'Failed to add career milestone.' });
  }
});

router.patch('/milestones/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    const [existing] = await db
      .select()
      .from(careerMilestones)
      .where(and(eq(careerMilestones.id, id), eq(careerMilestones.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Career milestone not found.' });

    const b = req.body || {};
    const nextDone = b.isCompleted !== undefined ? Boolean(b.isCompleted) : existing.isCompleted;
    const [updated] = await db
      .update(careerMilestones)
      .set({
        title: b.title !== undefined ? String(b.title).trim() : existing.title,
        targetDate: b.targetDate !== undefined ? b.targetDate : existing.targetDate,
        isCompleted: nextDone,
        completedAt: nextDone ? existing.completedAt || new Date() : null,
        notes: b.notes !== undefined ? String(b.notes) : existing.notes,
      })
      .where(eq(careerMilestones.id, id))
      .returning();
    res.json({ milestone: updated });
  } catch (error) {
    console.error('PATCH /api/career/milestones/:id error:', error);
    res.status(500).json({ error: 'Failed to update career milestone.' });
  }
});

router.delete('/milestones/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const id = String(req.params.id);
    await db
      .delete(careerMilestones)
      .where(and(eq(careerMilestones.id, id), eq(careerMilestones.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/career/milestones/:id error:', error);
    res.status(500).json({ error: 'Failed to delete career milestone.' });
  }
});

export default router;
