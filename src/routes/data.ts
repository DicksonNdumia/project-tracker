import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import {
  careerMilestones,
  certifications,
  dailyPlans,
  focusSessions,
  interviewPrep,
  jobApplications,
  journalEntries,
  learningGoals,
  learningSessions,
  projectFeatures,
  projectMilestones,
  projectReleases,
  projects,
  subtasks,
  tasks,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { recalculateUserStreak } from '../services/streakService.ts';

const router = Router();
router.use(requireAuth);

function escapeCsvCell(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}

router.get('/export-csv', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const entity = String(req.query.entity || 'tasks');
    let csv = '';

    if (entity === 'tasks') {
      const rows = await db.select().from(tasks).where(eq(tasks.userId, userId));
      csv = toCsv(
        [
          'Title',
          'Category',
          'Priority',
          'Status',
          'Daily Commitment',
          'Recurrence',
          'Start Date',
          'Due Date',
          'Estimated Minutes',
          'Actual Minutes',
          'Notes',
        ],
        rows.map((r) => [
          r.title,
          r.categoryName,
          r.priority,
          r.status,
          r.isDailyCommitment ? 'Yes' : 'No',
          r.recurrence,
          r.startDate || '',
          r.dueDate || '',
          r.estimatedMinutes ?? '',
          r.actualMinutes ?? '',
          r.notes || '',
        ])
      );
    } else if (entity === 'projects') {
      const rows = await db.select().from(projects).where(eq(projects.userId, userId));
      csv = toCsv(
        ['Name', 'Category', 'Status', 'Progress %', 'Role', 'Technologies', 'GitHub URL', 'Live URL', 'Start Date'],
        rows.map((r) => [
          r.name,
          r.category,
          r.status,
          r.progress,
          r.role || '',
          (r.technologies || []).join('; '),
          r.githubUrl || '',
          r.liveUrl || '',
          r.startDate || '',
        ])
      );
    } else if (entity === 'focus') {
      const rows = await db.select().from(focusSessions).where(eq(focusSessions.userId, userId));
      csv = toCsv(
        ['Date', 'Mode', 'Planned Minutes', 'Actual Seconds', 'Status', 'Notes'],
        rows.map((r) => [
          r.sessionDate,
          r.mode,
          r.plannedMinutes,
          r.actualSeconds,
          r.status,
          r.notes || '',
        ])
      );
    } else if (entity === 'learning') {
      const goals = await db.select().from(learningGoals).where(eq(learningGoals.userId, userId));
      csv = toCsv(
        ['Skill', 'Current Level', 'Target Level', 'Progress %', 'Target Date', 'Notes'],
        goals.map((g) => [
          g.skillName,
          g.currentLevel,
          g.targetLevel,
          g.progress,
          g.targetDate || '',
          g.notes || '',
        ])
      );
    } else if (entity === 'career') {
      const apps = await db.select().from(jobApplications).where(eq(jobApplications.userId, userId));
      csv = toCsv(
        ['Company', 'Role', 'Status', 'Applied Date', 'Location', 'Salary Range', 'URL', 'Notes'],
        apps.map((a) => [
          a.company,
          a.roleTitle,
          a.status,
          a.appliedDate || '',
          a.location || '',
          a.salaryRange || '',
          a.jobUrl || '',
          a.notes || '',
        ])
      );
    } else {
      return res.status(400).json({ error: 'Unsupported CSV export entity.' });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="progress-tracker-${entity}-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (error) {
    console.error('GET /api/data/export-csv error:', error);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});

router.get('/backup', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [
      userProjects,
      userMilestones,
      userFeatures,
      userReleases,
      userTasks,
      userSubtasks,
      userDailyPlans,
      userFocus,
      userGoals,
      userLearningSessions,
      userJournal,
      userApps,
      userPrep,
      userCerts,
      userCareerMilestones,
    ] = await Promise.all([
      db.select().from(projects).where(eq(projects.userId, userId)),
      db.select().from(projectMilestones).where(eq(projectMilestones.userId, userId)),
      db.select().from(projectFeatures).where(eq(projectFeatures.userId, userId)),
      db.select().from(projectReleases).where(eq(projectReleases.userId, userId)),
      db.select().from(tasks).where(eq(tasks.userId, userId)),
      db.select().from(subtasks).where(eq(subtasks.userId, userId)),
      db.select().from(dailyPlans).where(eq(dailyPlans.userId, userId)),
      db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
      db.select().from(learningGoals).where(eq(learningGoals.userId, userId)),
      db.select().from(learningSessions).where(eq(learningSessions.userId, userId)),
      db.select().from(journalEntries).where(eq(journalEntries.userId, userId)),
      db.select().from(jobApplications).where(eq(jobApplications.userId, userId)),
      db.select().from(interviewPrep).where(eq(interviewPrep.userId, userId)),
      db.select().from(certifications).where(eq(certifications.userId, userId)),
      db.select().from(careerMilestones).where(eq(careerMilestones.userId, userId)),
    ]);

    res.json({
      version: 2,
      exportedAt: new Date().toISOString(),
      user: {
        displayName: req.dbUser!.displayName,
        timezone: req.dbUser!.timezone,
        dailyCommitmentTarget: req.dbUser!.dailyCommitmentTarget,
      },
      data: {
        projects: userProjects,
        projectMilestones: userMilestones,
        projectFeatures: userFeatures,
        projectReleases: userReleases,
        tasks: userTasks,
        subtasks: userSubtasks,
        dailyPlans: userDailyPlans,
        focusSessions: userFocus,
        learningGoals: userGoals,
        learningSessions: userLearningSessions,
        journalEntries: userJournal,
        jobApplications: userApps,
        interviewPrep: userPrep,
        certifications: userCerts,
        careerMilestones: userCareerMilestones,
      },
    });
  } catch (error) {
    console.error('GET /api/data/backup error:', error);
    res.status(500).json({ error: 'Failed to export backup.' });
  }
});

router.post('/restore', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const body = req.body;
    const d = body?.data;
    if (!d || typeof d !== 'object') {
      return res.status(400).json({ error: 'Invalid backup payload: missing data object.' });
    }

    let restoredCount = 0;

    // Projects first (referenced by tasks, milestones, features, releases)
    const projectIdMap = new Map<string, string>();
    if (Array.isArray(d.projects)) {
      for (const p of d.projects) {
        if (!p.name) continue;
        const [inserted] = await db
          .insert(projects)
          .values({
            userId,
            name: String(p.name),
            slug: `${String(p.slug || 'project')}-rest-${Date.now().toString(36).slice(-4)}`,
            description: String(p.description || ''),
            objectives: String(p.objectives || ''),
            category: String(p.category || 'Web Application'),
            status: String(p.status || 'Planning'),
            role: String(p.role || 'Developer'),
            githubUrl: String(p.githubUrl || ''),
            liveUrl: String(p.liveUrl || ''),
            coverImageUrl: String(p.coverImageUrl || ''),
            startDate: p.startDate || null,
            completionDate: p.completionDate || null,
            keyFeatures: Array.isArray(p.keyFeatures) ? p.keyFeatures : [],
            challenges: String(p.challenges || ''),
            solutions: String(p.solutions || ''),
            lessonsLearned: String(p.lessonsLearned || ''),
            technologies: Array.isArray(p.technologies) ? p.technologies : [],
            frameworks: Array.isArray(p.frameworks) ? p.frameworks : [],
            isPublic: Boolean(p.isPublic),
            progress: Number(p.progress) || 0,
          })
          .returning();
        if (p.id) projectIdMap.set(String(p.id), inserted.id);
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.projectMilestones)) {
      for (const m of d.projectMilestones) {
        const mappedProject = projectIdMap.get(String(m.projectId));
        if (!mappedProject || !m.title) continue;
        await db.insert(projectMilestones).values({
          projectId: mappedProject,
          userId,
          title: String(m.title),
          description: String(m.description || ''),
          dueDate: m.dueDate || null,
          isCompleted: Boolean(m.isCompleted),
        });
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.projectFeatures)) {
      for (const f of d.projectFeatures) {
        const mappedProject = projectIdMap.get(String(f.projectId));
        if (!mappedProject || !f.title) continue;
        await db.insert(projectFeatures).values({
          projectId: mappedProject,
          userId,
          title: String(f.title),
          description: String(f.description || ''),
          status: String(f.status || 'Planned'),
          priority: String(f.priority || 'Medium'),
        });
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.projectReleases)) {
      for (const r of d.projectReleases) {
        const mappedProject = projectIdMap.get(String(r.projectId));
        if (!mappedProject || !r.version || !r.title) continue;
        await db.insert(projectReleases).values({
          projectId: mappedProject,
          userId,
          version: String(r.version),
          title: String(r.title),
          releaseNotes: String(r.releaseNotes || ''),
          releaseDate: r.releaseDate || null,
          status: String(r.status || 'Planned'),
        });
        restoredCount += 1;
      }
    }

    const taskIdMap = new Map<string, string>();
    if (Array.isArray(d.tasks)) {
      for (const t of d.tasks) {
        if (!t.title) continue;
        const [inserted] = await db
          .insert(tasks)
          .values({
            userId,
            projectId: t.projectId ? projectIdMap.get(String(t.projectId)) || null : null,
            categoryName: String(t.categoryName || 'Engineering'),
            title: String(t.title),
            description: String(t.description || ''),
            priority: String(t.priority || 'Medium'),
            status: String(t.status || 'Pending'),
            isDailyCommitment: Boolean(t.isDailyCommitment),
            recurrence: String(t.recurrence || 'None'),
            startDate: t.startDate || null,
            dueDate: t.dueDate || null,
            estimatedMinutes: Number(t.estimatedMinutes) || 30,
            actualMinutes: t.actualMinutes != null ? Number(t.actualMinutes) : null,
            notes: String(t.notes || ''),
            completedAt: t.status === 'Completed' ? new Date() : null,
          })
          .returning();
        if (t.id) taskIdMap.set(String(t.id), inserted.id);
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.subtasks)) {
      for (const s of d.subtasks) {
        const mappedTask = taskIdMap.get(String(s.taskId));
        if (!mappedTask || !s.title) continue;
        await db.insert(subtasks).values({
          taskId: mappedTask,
          userId,
          title: String(s.title),
          isCompleted: Boolean(s.isCompleted),
          sortOrder: Number(s.sortOrder) || 0,
        });
      }
    }

    if (Array.isArray(d.dailyPlans)) {
      for (const dp of d.dailyPlans) {
        if (!dp.planDate) continue;
        await db
          .insert(dailyPlans)
          .values({
            userId,
            planDate: String(dp.planDate),
            mits: Array.isArray(dp.mits) ? dp.mits : [],
            tomorrowTasks: Array.isArray(dp.tomorrowTasks) ? dp.tomorrowTasks : [],
            accomplishments: String(dp.accomplishments || ''),
            unfinishedNotes: String(dp.unfinishedNotes || ''),
            challenges: String(dp.challenges || ''),
            isReviewed: Boolean(dp.isReviewed),
          })
          .onConflictDoNothing({ target: [dailyPlans.userId, dailyPlans.planDate] });
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.learningGoals)) {
      for (const g of d.learningGoals) {
        if (!g.skillName) continue;
        await db.insert(learningGoals).values({
          userId,
          skillName: String(g.skillName),
          description: String(g.description || ''),
          currentLevel: String(g.currentLevel || 'Beginner'),
          targetLevel: String(g.targetLevel || 'Advanced'),
          startDate: g.startDate || null,
          targetDate: g.targetDate || null,
          resources: Array.isArray(g.resources) ? g.resources : [],
          progress: Number(g.progress) || 0,
          notes: String(g.notes || ''),
        });
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.journalEntries)) {
      for (const j of d.journalEntries) {
        if (!j.title || !j.entryDate) continue;
        await db.insert(journalEntries).values({
          userId,
          title: String(j.title),
          entryDate: String(j.entryDate),
          reflections: String(j.reflections || ''),
          learnedToday: String(j.learnedToday || ''),
          challenges: String(j.challenges || ''),
          improvements: String(j.improvements || ''),
          projectIdeas: String(j.projectIdeas || ''),
          achievementsText: String(j.achievementsText || ''),
        });
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.jobApplications)) {
      for (const a of d.jobApplications) {
        if (!a.company || !a.roleTitle) continue;
        await db.insert(jobApplications).values({
          userId,
          company: String(a.company),
          roleTitle: String(a.roleTitle),
          status: String(a.status || 'Applied'),
          appliedDate: a.appliedDate || null,
          salaryRange: String(a.salaryRange || ''),
          location: String(a.location || 'Remote'),
          jobUrl: String(a.jobUrl || ''),
          notes: String(a.notes || ''),
        });
        restoredCount += 1;
      }
    }

    if (Array.isArray(d.certifications)) {
      for (const c of d.certifications) {
        if (!c.name || !c.issuer) continue;
        await db.insert(certifications).values({
          userId,
          name: String(c.name),
          issuer: String(c.issuer),
          status: String(c.status || 'In Progress'),
          earnedDate: c.earnedDate || null,
          expiryDate: c.expiryDate || null,
          credentialId: String(c.credentialId || ''),
          credentialUrl: String(c.credentialUrl || ''),
          notes: String(c.notes || ''),
        });
        restoredCount += 1;
      }
    }

    await recalculateUserStreak(userId);
    res.json({ ok: true, restoredCount });
  } catch (error) {
    console.error('POST /api/data/restore error:', error);
    res.status(500).json({ error: 'Failed to restore backup file.' });
  }
});

export default router;
