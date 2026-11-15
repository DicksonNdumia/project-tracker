import { and, asc, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../db/index.ts';
import {
  focusSessions,
  notifications,
  projectFeatures,
  projectImages,
  projectMilestones,
  projectReleases,
  projects,
  tasks,
  users,
} from '../db/schema.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';

const router = Router();

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'project';
}

// Public portfolio endpoint (no auth required, returns strictly isPublic = true projects)
router.get('/public/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const [owner] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        portfolioSlug: users.portfolioSlug,
      })
      .from(users)
      .where(eq(users.portfolioSlug, slug));

    if (!owner) {
      return res.status(404).json({ error: 'Portfolio not found.' });
    }

    const publicProjects = await db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, owner.id), eq(projects.isPublic, true)))
      .orderBy(desc(projects.updatedAt));

    const allImages = await db
      .select()
      .from(projectImages)
      .where(eq(projectImages.userId, owner.id))
      .orderBy(asc(projectImages.sortOrder));

    const allMilestones = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.userId, owner.id))
      .orderBy(asc(projectMilestones.createdAt));

    const enriched = publicProjects.map((p) => ({
      ...p,
      images: allImages.filter((img) => img.projectId === p.id),
      milestones: allMilestones.filter((m) => m.projectId === p.id),
    }));

    res.json({ owner, projects: enriched });
  } catch (error) {
    console.error('GET /api/projects/public/:slug error:', error);
    res.status(500).json({ error: 'Failed to load public portfolio.' });
  }
});

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [
      allProjects,
      allMilestones,
      allImages,
      allFeatures,
      allReleases,
      allTasks,
      allFocus,
    ] = await Promise.all([
      db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt)),
      db.select().from(projectMilestones).where(eq(projectMilestones.userId, userId)).orderBy(asc(projectMilestones.createdAt)),
      db.select().from(projectImages).where(eq(projectImages.userId, userId)).orderBy(asc(projectImages.sortOrder)),
      db.select().from(projectFeatures).where(eq(projectFeatures.userId, userId)).orderBy(asc(projectFeatures.createdAt)),
      db.select().from(projectReleases).where(eq(projectReleases.userId, userId)).orderBy(desc(projectReleases.createdAt)),
      db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.dueDate)),
      db.select().from(focusSessions).where(eq(focusSessions.userId, userId)),
    ]);

    const enriched = allProjects.map((p) => {
      const pFocusSeconds = allFocus
        .filter((f) => f.projectId === p.id && f.mode === 'focus')
        .reduce((acc, f) => acc + (f.actualSeconds || 0), 0);
      return {
        ...p,
        milestones: allMilestones.filter((m) => m.projectId === p.id),
        images: allImages.filter((i) => i.projectId === p.id),
        features: allFeatures.filter((f) => f.projectId === p.id),
        releases: allReleases.filter((r) => r.projectId === p.id),
        linkedTasks: allTasks.filter((t) => t.projectId === p.id),
        focusMinutes: Math.round(pFocusSeconds / 60),
      };
    });

    res.json({ projects: enriched });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    res.status(500).json({ error: 'Failed to load projects.' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const [created] = await db
      .insert(projects)
      .values({
        userId,
        name: String(b.name).trim(),
        slug: `${slugify(String(b.name))}-${Date.now().toString(36).slice(-4)}`,
        description: String(b.description || ''),
        objectives: String(b.objectives || ''),
        category: String(b.category || 'Web Application'),
        status: String(b.status || 'Planning'),
        role: String(b.role || 'Solo Full-Stack Engineer'),
        githubUrl: String(b.githubUrl || ''),
        liveUrl: String(b.liveUrl || ''),
        coverImageUrl: String(b.coverImageUrl || ''),
        startDate: b.startDate || null,
        completionDate: b.completionDate || null,
        keyFeatures: Array.isArray(b.keyFeatures) ? b.keyFeatures : [],
        challenges: String(b.challenges || ''),
        solutions: String(b.solutions || ''),
        lessonsLearned: String(b.lessonsLearned || ''),
        technologies: Array.isArray(b.technologies) ? b.technologies : [],
        frameworks: Array.isArray(b.frameworks) ? b.frameworks : [],
        isPublic: Boolean(b.isPublic),
        progress: Number(b.progress) || 0,
      })
      .returning();

    res.status(201).json({
      project: {
        ...created,
        milestones: [],
        images: [],
        features: [],
        releases: [],
        linkedTasks: [],
        focusMinutes: 0,
      },
    });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const projectId = String(req.params.id);
    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Project not found.' });

    const b = req.body || {};
    const [updated] = await db
      .update(projects)
      .set({
        name: b.name !== undefined ? String(b.name).trim() : existing.name,
        description: b.description !== undefined ? String(b.description) : existing.description,
        objectives: b.objectives !== undefined ? String(b.objectives) : existing.objectives,
        category: b.category !== undefined ? String(b.category) : existing.category,
        status: b.status !== undefined ? String(b.status) : existing.status,
        role: b.role !== undefined ? String(b.role) : existing.role,
        githubUrl: b.githubUrl !== undefined ? String(b.githubUrl) : existing.githubUrl,
        liveUrl: b.liveUrl !== undefined ? String(b.liveUrl) : existing.liveUrl,
        coverImageUrl:
          b.coverImageUrl !== undefined ? String(b.coverImageUrl) : existing.coverImageUrl,
        startDate: b.startDate !== undefined ? b.startDate : existing.startDate,
        completionDate:
          b.completionDate !== undefined ? b.completionDate : existing.completionDate,
        keyFeatures: Array.isArray(b.keyFeatures) ? b.keyFeatures : existing.keyFeatures,
        challenges: b.challenges !== undefined ? String(b.challenges) : existing.challenges,
        solutions: b.solutions !== undefined ? String(b.solutions) : existing.solutions,
        lessonsLearned:
          b.lessonsLearned !== undefined ? String(b.lessonsLearned) : existing.lessonsLearned,
        technologies: Array.isArray(b.technologies) ? b.technologies : existing.technologies,
        frameworks: Array.isArray(b.frameworks) ? b.frameworks : existing.frameworks,
        isPublic: b.isPublic !== undefined ? Boolean(b.isPublic) : existing.isPublic,
        progress: b.progress !== undefined ? Number(b.progress) : existing.progress,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();

    const [milestones, images, features, releases, linkedTasks, focusRows] = await Promise.all([
      db.select().from(projectMilestones).where(eq(projectMilestones.projectId, projectId)),
      db.select().from(projectImages).where(eq(projectImages.projectId, projectId)),
      db.select().from(projectFeatures).where(eq(projectFeatures.projectId, projectId)),
      db.select().from(projectReleases).where(eq(projectReleases.projectId, projectId)),
      db.select().from(tasks).where(and(eq(tasks.projectId, projectId), eq(tasks.userId, userId))),
      db.select().from(focusSessions).where(and(eq(focusSessions.projectId, projectId), eq(focusSessions.userId, userId))),
    ]);
    const focusMinutes = Math.round(
      focusRows
        .filter((f) => f.mode === 'focus')
        .reduce((acc, f) => acc + (f.actualSeconds || 0), 0) / 60
    );

    res.json({
      project: { ...updated, milestones, images, features, releases, linkedTasks, focusMinutes },
    });
  } catch (error) {
    console.error('PATCH /api/projects/:id error:', error);
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const projectId = String(req.params.id);
    const deleted = await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning();
    if (deleted.length === 0) return res.status(404).json({ error: 'Project not found.' });
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/projects/:id error:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

router.post('/:id/milestones', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const projectId = String(req.params.id);
    const { title, description = '', dueDate = null } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Milestone title is required.' });
    }
    const [proj] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!proj) return res.status(404).json({ error: 'Project not found.' });

    const [created] = await db
      .insert(projectMilestones)
      .values({
        projectId,
        userId,
        title: String(title).trim(),
        description: String(description),
        dueDate: dueDate || null,
      })
      .returning();

    const allMilestones = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId));
    const completedCount = allMilestones.filter((m) => m.isCompleted).length;
    const pct = Math.round((completedCount / allMilestones.length) * 100);
    await db
      .update(projects)
      .set({ progress: pct, updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    res.status(201).json({ milestone: created, projectProgress: pct });
  } catch (error) {
    console.error('POST /api/projects/:id/milestones error:', error);
    res.status(500).json({ error: 'Failed to add milestone.' });
  }
});

router.patch('/milestones/:milestoneId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const milestoneId = String(req.params.milestoneId);
    const { isCompleted, title, dueDate } = req.body || {};

    const [existing] = await db
      .select()
      .from(projectMilestones)
      .where(and(eq(projectMilestones.id, milestoneId), eq(projectMilestones.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Milestone not found.' });

    const nextCompleted =
      isCompleted !== undefined ? Boolean(isCompleted) : existing.isCompleted;

    const [updated] = await db
      .update(projectMilestones)
      .set({
        isCompleted: nextCompleted,
        title: title !== undefined ? String(title).trim() : existing.title,
        dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
        completedAt: nextCompleted ? existing.completedAt || new Date() : null,
      })
      .where(eq(projectMilestones.id, milestoneId))
      .returning();

    const allMilestones = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, existing.projectId));
    const completedCount = allMilestones.filter((m) => m.isCompleted).length;
    const pct = allMilestones.length > 0 ? Math.round((completedCount / allMilestones.length) * 100) : 0;

    await db
      .update(projects)
      .set({ progress: pct, updatedAt: new Date() })
      .where(eq(projects.id, existing.projectId));

    if (nextCompleted && !existing.isCompleted) {
      await db.insert(notifications).values({
        userId,
        type: 'milestone',
        title: 'Project Milestone Completed',
        message: `Completed milestone: ${updated.title}`,
        linkTab: 'projects',
      });
    }

    res.json({ milestone: updated, projectProgress: pct });
  } catch (error) {
    console.error('PATCH /api/projects/milestones/:milestoneId error:', error);
    res.status(500).json({ error: 'Failed to update milestone.' });
  }
});

router.delete('/milestones/:milestoneId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const milestoneId = String(req.params.milestoneId);
    const [existing] = await db
      .select()
      .from(projectMilestones)
      .where(and(eq(projectMilestones.id, milestoneId), eq(projectMilestones.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Milestone not found.' });

    await db.delete(projectMilestones).where(eq(projectMilestones.id, milestoneId));

    const remaining = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, existing.projectId));
    const pct =
      remaining.length > 0
        ? Math.round((remaining.filter((m) => m.isCompleted).length / remaining.length) * 100)
        : 0;
    await db
      .update(projects)
      .set({ progress: pct, updatedAt: new Date() })
      .where(eq(projects.id, existing.projectId));

    res.json({ ok: true, projectProgress: pct });
  } catch (error) {
    console.error('DELETE /api/projects/milestones/:milestoneId error:', error);
    res.status(500).json({ error: 'Failed to delete milestone.' });
  }
});

router.post('/:id/images', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const projectId = String(req.params.id);
    const { imageUrl, caption = '' } = req.body || {};
    if (!imageUrl || !String(imageUrl).trim()) {
      return res.status(400).json({ error: 'Image URL or data payload is required.' });
    }

    const [proj] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!proj) return res.status(404).json({ error: 'Project not found.' });

    const existingImages = await db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, projectId));

    const [created] = await db
      .insert(projectImages)
      .values({
        projectId,
        userId,
        imageUrl: String(imageUrl),
        caption: String(caption || ''),
        sortOrder: existingImages.length,
      })
      .returning();

    res.status(201).json({ image: created });
  } catch (error) {
    console.error('POST /api/projects/:id/images error:', error);
    res.status(500).json({ error: 'Failed to add project screenshot.' });
  }
});

router.delete('/images/:imageId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const imageId = String(req.params.imageId);
    await db
      .delete(projectImages)
      .where(and(eq(projectImages.id, imageId), eq(projectImages.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/projects/images/:imageId error:', error);
    res.status(500).json({ error: 'Failed to delete project screenshot.' });
  }
});

// Project Features CRUD
router.post('/:id/features', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const projectId = String(req.params.id);
    const { title, description = '', status = 'Planned', priority = 'Medium' } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Feature title is required.' });
    }
    const [proj] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!proj) return res.status(404).json({ error: 'Project not found.' });

    const [created] = await db
      .insert(projectFeatures)
      .values({
        projectId,
        userId,
        title: String(title).trim(),
        description: String(description || ''),
        status: String(status || 'Planned'),
        priority: String(priority || 'Medium'),
      })
      .returning();
    res.status(201).json({ feature: created });
  } catch (error) {
    console.error('POST /api/projects/:id/features error:', error);
    res.status(500).json({ error: 'Failed to create project feature.' });
  }
});

router.patch('/features/:featureId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const featureId = String(req.params.featureId);
    const [existing] = await db
      .select()
      .from(projectFeatures)
      .where(and(eq(projectFeatures.id, featureId), eq(projectFeatures.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Feature not found.' });

    const b = req.body || {};
    const [updated] = await db
      .update(projectFeatures)
      .set({
        title: b.title !== undefined ? String(b.title).trim() : existing.title,
        description: b.description !== undefined ? String(b.description) : existing.description,
        status: b.status !== undefined ? String(b.status) : existing.status,
        priority: b.priority !== undefined ? String(b.priority) : existing.priority,
      })
      .where(eq(projectFeatures.id, featureId))
      .returning();
    res.json({ feature: updated });
  } catch (error) {
    console.error('PATCH /api/projects/features/:featureId error:', error);
    res.status(500).json({ error: 'Failed to update project feature.' });
  }
});

router.delete('/features/:featureId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const featureId = String(req.params.featureId);
    await db
      .delete(projectFeatures)
      .where(and(eq(projectFeatures.id, featureId), eq(projectFeatures.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/projects/features/:featureId error:', error);
    res.status(500).json({ error: 'Failed to delete project feature.' });
  }
});

// Project Releases CRUD
router.post('/:id/releases', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const projectId = String(req.params.id);
    const {
      version,
      title,
      releaseNotes = '',
      releaseDate = null,
      status = 'Planned',
    } = req.body || {};
    if (!version || !String(version).trim() || !title || !String(title).trim()) {
      return res.status(400).json({ error: 'Version tag and release title are required.' });
    }
    const [proj] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!proj) return res.status(404).json({ error: 'Project not found.' });

    const [created] = await db
      .insert(projectReleases)
      .values({
        projectId,
        userId,
        version: String(version).trim(),
        title: String(title).trim(),
        releaseNotes: String(releaseNotes || ''),
        releaseDate: releaseDate || null,
        status: String(status || 'Planned'),
      })
      .returning();
    res.status(201).json({ release: created });
  } catch (error) {
    console.error('POST /api/projects/:id/releases error:', error);
    res.status(500).json({ error: 'Failed to add project release.' });
  }
});

router.patch('/releases/:releaseId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const releaseId = String(req.params.releaseId);
    const [existing] = await db
      .select()
      .from(projectReleases)
      .where(and(eq(projectReleases.id, releaseId), eq(projectReleases.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Release not found.' });

    const b = req.body || {};
    const [updated] = await db
      .update(projectReleases)
      .set({
        version: b.version !== undefined ? String(b.version).trim() : existing.version,
        title: b.title !== undefined ? String(b.title).trim() : existing.title,
        releaseNotes:
          b.releaseNotes !== undefined ? String(b.releaseNotes) : existing.releaseNotes,
        releaseDate: b.releaseDate !== undefined ? b.releaseDate : existing.releaseDate,
        status: b.status !== undefined ? String(b.status) : existing.status,
      })
      .where(eq(projectReleases.id, releaseId))
      .returning();
    res.json({ release: updated });
  } catch (error) {
    console.error('PATCH /api/projects/releases/:releaseId error:', error);
    res.status(500).json({ error: 'Failed to update release.' });
  }
});

router.delete('/releases/:releaseId', async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const releaseId = String(req.params.releaseId);
    await db
      .delete(projectReleases)
      .where(and(eq(projectReleases.id, releaseId), eq(projectReleases.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/projects/releases/:releaseId error:', error);
    res.status(500).json({ error: 'Failed to delete release.' });
  }
});

export default router;
