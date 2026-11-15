import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// 1. Users / Profiles (keyed by Firebase Auth UID)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Developer'),
  avatarUrl: text('avatar_url'),
  bio: text('bio').default('Full-stack engineer building with intentional focus and measurable consistency.'),
  portfolioSlug: text('portfolio_slug').unique(),
  timezone: text('timezone').notNull().default('UTC'),
  dailyCommitmentTarget: integer('daily_commitment_target').notNull().default(1),
  theme: text('theme').notNull().default('dark'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. User Settings
export const userSettings = pgTable('user_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  emailReminders: boolean('email_reminders').notNull().default(true),
  deadlineAlerts: boolean('deadline_alerts').notNull().default(true),
  streakReminders: boolean('streak_reminders').notNull().default(true),
  milestoneAlerts: boolean('milestone_alerts').notNull().default(true),
  reminderTime: text('reminder_time').notNull().default('09:00'),
  githubAutoSync: boolean('github_auto_sync').notNull().default(true),
  publicPortfolioEnabled: boolean('public_portfolio_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Task Categories
export const taskCategories = pgTable('task_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#10b981'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Projects (Personal Project Manager & Developer Portfolio)
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default(''),
  objectives: text('objectives').default(''),
  category: text('category').notNull().default('Web Application'),
  status: text('status').notNull().default('In Progress'), // Planning | In Progress | On Hold | Completed | Archived
  role: text('role').default('Solo Full-Stack Engineer'),
  githubUrl: text('github_url').default(''),
  liveUrl: text('live_url').default(''),
  coverImageUrl: text('cover_image_url').default(''),
  startDate: text('start_date'),
  completionDate: text('completion_date'),
  keyFeatures: jsonb('key_features').$type<string[]>().notNull().default([]),
  challenges: text('challenges').default(''),
  solutions: text('solutions').default(''),
  lessonsLearned: text('lessons_learned').default(''),
  technologies: jsonb('technologies').$type<string[]>().notNull().default([]),
  frameworks: jsonb('frameworks').$type<string[]>().notNull().default([]),
  isPublic: boolean('is_public').notNull().default(false),
  progress: integer('progress').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Tasks (extended with projectId + dependsOnTaskId)
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: uuid('category_id').references(() => taskCategories.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    dependsOnTaskId: uuid('depends_on_task_id'),
    categoryName: text('category_name').notNull().default('Engineering'),
    title: text('title').notNull(),
    description: text('description').default(''),
    priority: text('priority').notNull().default('Medium'), // Low | Medium | High | Urgent
    status: text('status').notNull().default('Pending'), // Pending | In Progress | Completed | Cancelled
    isDailyCommitment: boolean('is_daily_commitment').notNull().default(false),
    recurrence: text('recurrence').notNull().default('None'), // None | Daily | Weekly | Monthly
    startDate: text('start_date'), // YYYY-MM-DD
    dueDate: text('due_date'), // YYYY-MM-DD
    estimatedMinutes: integer('estimated_minutes').default(30),
    actualMinutes: integer('actual_minutes'),
    notes: text('notes').default(''),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('tasks_user_status_idx').on(table.userId, table.status),
    index('tasks_user_due_idx').on(table.userId, table.dueDate),
  ]
);

// 6. Subtasks
export const subtasks = pgTable('subtasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .references(() => tasks.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Daily Progress (Streak computation source of truth)
export const dailyProgress = pgTable(
  'daily_progress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(), // YYYY-MM-DD in user's configured timezone
    commitmentsCompleted: integer('commitments_completed').notNull().default(0),
    commitmentsTarget: integer('commitments_target').notNull().default(1),
    tasksCompleted: integer('tasks_completed').notNull().default(0),
    isSuccess: boolean('is_success').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('daily_progress_user_date_uidx').on(table.userId, table.date)]
);

// 8. Daily Planning (MITs, End-of-Day Review, Tomorrow Plan)
export const dailyPlans = pgTable(
  'daily_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    planDate: text('plan_date').notNull(), // YYYY-MM-DD
    mits: jsonb('mits')
      .$type<Array<{ id: string; title: string; taskId?: string | null; completed: boolean }>>()
      .notNull()
      .default([]),
    tomorrowTasks: jsonb('tomorrow_tasks')
      .$type<Array<{ id: string; title: string; priority: string; addedToTasks?: boolean }>>()
      .notNull()
      .default([]),
    accomplishments: text('accomplishments').default(''),
    unfinishedNotes: text('unfinished_notes').default(''),
    challenges: text('challenges').default(''),
    isReviewed: boolean('is_reviewed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('daily_plans_user_date_uidx').on(table.userId, table.planDate)]
);

// 9. Focus Sessions (Pomodoro & Deep Work Analytics)
export const focusSessions = pgTable(
  'focus_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    mode: text('mode').notNull().default('focus'), // focus | short_break | long_break
    plannedMinutes: integer('planned_minutes').notNull().default(25),
    actualSeconds: integer('actual_seconds').notNull().default(0),
    status: text('status').notNull().default('completed'), // completed | cancelled
    notes: text('notes').default(''),
    sessionDate: text('session_date').notNull(), // YYYY-MM-DD
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [index('focus_sessions_user_date_idx').on(table.userId, table.sessionDate)]
);

// 10. Streak History Summary
export const streakHistory = pgTable('streak_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  totalActiveDays: integer('total_active_days').notNull().default(0),
  lastActiveDate: text('last_active_date'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 11. Achievements
export const achievements = pgTable(
  'achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    milestoneDays: integer('milestone_days').notNull().default(0),
    unlockedAt: timestamp('unlocked_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('achievements_user_code_uidx').on(table.userId, table.code)]
);

// 12. GitHub Accounts (accessToken stays server-side only!)
export const githubAccounts = pgTable('github_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  githubId: text('github_id').notNull(),
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  profileUrl: text('profile_url'),
  accessToken: text('access_token').notNull(),
  scope: text('scope').default('read:user repo'),
  publicReposCount: integer('public_repos_count').notNull().default(0),
  followersCount: integer('followers_count').notNull().default(0),
  lastSyncedAt: timestamp('last_synced_at'),
  syncError: text('sync_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. GitHub Daily Contributions
export const githubContributions = pgTable(
  'github_contributions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    count: integer('count').notNull().default(0),
    level: integer('level').notNull().default(0), // 0..4
  },
  (table) => [uniqueIndex('github_contrib_user_date_uidx').on(table.userId, table.date)]
);

// 14. GitHub Repositories
export const githubRepositories = pgTable(
  'github_repositories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    repoId: text('repo_id').notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').notNull(),
    description: text('description').default(''),
    language: text('language').default('TypeScript'),
    stars: integer('stars').notNull().default(0),
    forks: integer('forks').notNull().default(0),
    openIssues: integer('open_issues').notNull().default(0),
    htmlUrl: text('html_url').notNull(),
    pushedAt: timestamp('pushed_at'),
    isPrivate: boolean('is_private').notNull().default(false),
  },
  (table) => [uniqueIndex('github_repo_user_repoid_uidx').on(table.userId, table.repoId)]
);

// 15. GitHub Recent Activity (Commits, PRs, Issues)
export const githubActivity = pgTable(
  'github_activity',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(), // commit | pr | issue | release
    repoName: text('repo_name').notNull(),
    title: text('title').notNull(),
    state: text('state').default('open'), // open | closed | merged
    url: text('url').notNull(),
    occurredAt: timestamp('occurred_at').notNull(),
  },
  (table) => [uniqueIndex('github_activity_user_event_uidx').on(table.userId, table.eventId)]
);

// 16. Project Milestones
export const projectMilestones = pgTable('project_milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  dueDate: text('due_date'),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Project Images / Screenshots
export const projectImages = pgTable('project_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  imageUrl: text('image_url').notNull(),
  caption: text('caption').default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Project Features (Feature development tracking)
export const projectFeatures = pgTable('project_features', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  status: text('status').notNull().default('Planned'), // Planned | In Progress | Shipped
  priority: text('priority').notNull().default('Medium'), // Low | Medium | High
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Project Releases & Versions
export const projectReleases = pgTable('project_releases', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  version: text('version').notNull(),
  title: text('title').notNull(),
  releaseNotes: text('release_notes').default(''),
  releaseDate: text('release_date'),
  status: text('status').notNull().default('Planned'), // Planned | Released
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Learning Goals
export const learningGoals = pgTable('learning_goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  skillName: text('skill_name').notNull(),
  description: text('description').default(''),
  currentLevel: text('current_level').notNull().default('Beginner'), // Beginner | Intermediate | Advanced | Expert
  targetLevel: text('target_level').notNull().default('Advanced'),
  startDate: text('start_date'),
  targetDate: text('target_date'),
  resources: jsonb('resources').$type<{ title: string; url: string }[]>().notNull().default([]),
  progress: integer('progress').notNull().default(0),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 21. Learning Sessions
export const learningSessions = pgTable('learning_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  goalId: uuid('goal_id')
    .references(() => learningGoals.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  topic: text('topic').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  takeaways: text('takeaways').default(''),
  sessionDate: text('session_date').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 22. Journal Entries
export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  entryDate: text('entry_date').notNull(), // YYYY-MM-DD
  reflections: text('reflections').default(''),
  learnedToday: text('learned_today').default(''),
  challenges: text('challenges').default(''),
  improvements: text('improvements').default(''),
  projectIdeas: text('project_ideas').default(''),
  achievementsText: text('achievements_text').default(''),
  linkedTaskId: uuid('linked_task_id').references(() => tasks.id, { onDelete: 'set null' }),
  linkedProjectId: uuid('linked_project_id').references(() => projects.id, { onDelete: 'set null' }),
  linkedGoalId: uuid('linked_goal_id').references(() => learningGoals.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 23. Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull().default('reminder'), // deadline | overdue | reminder | learning | milestone | streak
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  linkTab: text('link_tab').default('dashboard'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 24. Weekly Performance Reports Archive
export const weeklyReports = pgTable(
  'weekly_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    weekStart: text('week_start').notNull(), // YYYY-MM-DD (Monday)
    weekEnd: text('week_end').notNull(), // YYYY-MM-DD (Sunday)
    tasksPlanned: integer('tasks_planned').notNull().default(0),
    tasksCompleted: integer('tasks_completed').notNull().default(0),
    completionPct: integer('completion_pct').notNull().default(0),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    githubContributions: integer('github_contributions').notNull().default(0),
    focusHours: text('focus_hours').notNull().default('0.0'),
    learningHours: text('learning_hours').notNull().default('0.0'),
    milestonesCompleted: integer('milestones_completed').notNull().default(0),
    improvementAreas: jsonb('improvement_areas').$type<string[]>().notNull().default([]),
    reportData: jsonb('report_data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('weekly_reports_user_week_uidx').on(table.userId, table.weekStart)]
);

// 25. Career Development: Job Applications
export const jobApplications = pgTable('job_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  company: text('company').notNull(),
  roleTitle: text('role_title').notNull(),
  status: text('status').notNull().default('Applied'), // Saved | Applied | Phone Screen | Technical | Final | Offer | Rejected
  appliedDate: text('applied_date'),
  salaryRange: text('salary_range').default(''),
  location: text('location').default('Remote'),
  jobUrl: text('job_url').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 26. Career Development: Interview Preparation & Practice Records
export const interviewPrep = pgTable('interview_prep', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  applicationId: uuid('application_id').references(() => jobApplications.id, {
    onDelete: 'set null',
  }),
  company: text('company').default('General'),
  topic: text('topic').notNull(),
  category: text('category').notNull().default('DSA'), // DSA | System Design | Behavioral | Domain
  difficulty: text('difficulty').notNull().default('Medium'), // Easy | Medium | Hard
  status: text('status').notNull().default('Practiced'), // Planned | Practiced | Mastered
  practiceDate: text('practice_date').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(45),
  feedback: text('feedback').default(''),
  improvementNotes: text('improvement_notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 27. Career Development: Certifications
export const certifications = pgTable('certifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  issuer: text('issuer').notNull(),
  status: text('status').notNull().default('In Progress'), // In Progress | Earned | Expired
  earnedDate: text('earned_date'),
  expiryDate: text('expiry_date'),
  credentialId: text('credential_id').default(''),
  credentialUrl: text('credential_url').default(''),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 28. Career Development: Career Milestones
export const careerMilestones = pgTable('career_milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  targetDate: text('target_date'),
  isCompleted: boolean('is_completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
  streak: one(streakHistory, { fields: [users.id], references: [streakHistory.userId] }),
  githubAccount: one(githubAccounts, { fields: [users.id], references: [githubAccounts.userId] }),
  tasks: many(tasks),
  projects: many(projects),
  learningGoals: many(learningGoals),
  journalEntries: many(journalEntries),
  notifications: many(notifications),
  dailyPlans: many(dailyPlans),
  focusSessions: many(focusSessions),
  weeklyReports: many(weeklyReports),
  jobApplications: many(jobApplications),
  interviewPrep: many(interviewPrep),
  certifications: many(certifications),
  careerMilestones: many(careerMilestones),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  subtasks: many(subtasks),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, { fields: [subtasks.taskId], references: [tasks.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  milestones: many(projectMilestones),
  images: many(projectImages),
  features: many(projectFeatures),
  releases: many(projectReleases),
  tasks: many(tasks),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
  project: one(projects, { fields: [projectMilestones.projectId], references: [projects.id] }),
}));

export const projectImagesRelations = relations(projectImages, ({ one }) => ({
  project: one(projects, { fields: [projectImages.projectId], references: [projects.id] }),
}));

export const projectFeaturesRelations = relations(projectFeatures, ({ one }) => ({
  project: one(projects, { fields: [projectFeatures.projectId], references: [projects.id] }),
}));

export const projectReleasesRelations = relations(projectReleases, ({ one }) => ({
  project: one(projects, { fields: [projectReleases.projectId], references: [projects.id] }),
}));

export const learningGoalsRelations = relations(learningGoals, ({ one, many }) => ({
  user: one(users, { fields: [learningGoals.userId], references: [users.id] }),
  sessions: many(learningSessions),
}));

export const learningSessionsRelations = relations(learningSessions, ({ one }) => ({
  goal: one(learningGoals, { fields: [learningSessions.goalId], references: [learningGoals.id] }),
}));
