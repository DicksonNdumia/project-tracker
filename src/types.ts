export type NavTab =
  | 'dashboard'
  | 'planning'
  | 'tasks'
  | 'focus'
  | 'calendar'
  | 'streaks'
  | 'github'
  | 'projects'
  | 'learning'
  | 'career'
  | 'analytics'
  | 'journal'
  | 'settings';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  portfolioSlug: string | null;
  timezone: string;
  dailyCommitmentTarget: number;
  theme: 'light' | 'dark';
}

export interface UserSettings {
  id: string;
  userId: string;
  emailReminders: boolean;
  deadlineAlerts: boolean;
  streakReminders: boolean;
  milestoneAlerts: boolean;
  reminderTime: string;
  githubAutoSync: boolean;
  publicPortfolioEnabled: boolean;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
}

export interface TaskItem {
  id: string;
  projectId: string | null;
  dependsOnTaskId: string | null;
  title: string;
  description: string;
  categoryName: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  isDailyCommitment: boolean;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  startDate: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  notes: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: Subtask[];
}

export interface DailyProgressItem {
  id: string;
  date: string;
  commitmentsCompleted: number;
  commitmentsTarget: number;
  tasksCompleted: number;
  isSuccess: boolean;
}

export interface AchievementItem {
  id: string;
  code: string;
  title: string;
  description: string;
  milestoneDays: number;
  unlockedAt: string;
}

export interface StreakDashboardData {
  summary: {
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActiveDate: string | null;
  };
  todayKey: string;
  todayProgress: {
    date: string;
    commitmentsCompleted: number;
    commitmentsTarget: number;
    tasksCompleted: number;
    isSuccess: boolean;
  };
  weeklyConsistencyPct: number;
  monthlyConsistencyPct: number;
  dailyTarget: number;
  timezone: string;
  history: DailyProgressItem[];
  achievements: AchievementItem[];
}

export interface GitHubOverviewData {
  oauthConfigured: boolean;
  connected: boolean;
  callbackUrl: string;
  account: {
    id: string;
    username: string;
    avatarUrl: string | null;
    profileUrl: string | null;
    publicReposCount: number;
    followersCount: number;
    lastSyncedAt: string | null;
    syncError: string | null;
  } | null;
  stats: {
    totalContributions: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    currentStreak: number;
    longestStreak: number;
    publicRepos: number;
  };
  contributions: Array<{ date: string; count: number; level: number }>;
  repositories: Array<{
    id: string;
    repoId: string;
    name: string;
    fullName: string;
    description: string;
    language: string;
    stars: number;
    forks: number;
    openIssues: number;
    htmlUrl: string;
    pushedAt: string | null;
    isPrivate: boolean;
  }>;
  activity: Array<{
    id: string;
    eventId: string;
    eventType: 'commit' | 'pr' | 'issue' | 'release';
    repoName: string;
    title: string;
    state: string;
    url: string;
    occurredAt: string;
  }>;
  analytics?: {
    languageBreakdown: Array<{ language: string; count: number; pct: number }>;
    mostActiveRepos: Array<{
      id: string;
      name: string;
      fullName: string;
      language: string;
      stars: number;
      forks: number;
      openIssues: number;
      recentEvents: number;
      activityScore: number;
      htmlUrl: string;
      pushedAt: string | null;
    }>;
    weeklyTrends: Array<{ weekStart: string; fullWeekStart: string; count: number }>;
    monthlyTrends: Array<{ month: string; count: number }>;
  };
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface ProjectImage {
  id: string;
  projectId: string;
  imageUrl: string;
  caption: string;
  sortOrder: number;
}

export interface ProjectFeature {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'Planned' | 'In Progress' | 'Shipped';
  priority: 'Low' | 'Medium' | 'High';
  createdAt: string;
}

export interface ProjectRelease {
  id: string;
  projectId: string;
  version: string;
  title: string;
  releaseNotes: string;
  releaseDate: string | null;
  status: 'Planned' | 'Released';
  createdAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  objectives: string;
  category: string;
  status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Archived';
  role: string;
  githubUrl: string;
  liveUrl: string;
  coverImageUrl: string;
  startDate: string | null;
  completionDate: string | null;
  keyFeatures: string[];
  challenges: string;
  solutions: string;
  lessonsLearned: string;
  technologies: string[];
  frameworks: string[];
  isPublic: boolean;
  progress: number;
  createdAt: string;
  updatedAt: string;
  milestones: ProjectMilestone[];
  images: ProjectImage[];
  features?: ProjectFeature[];
  releases?: ProjectRelease[];
  linkedTasks?: TaskItem[];
  focusMinutes?: number;
}

export interface LearningSession {
  id: string;
  goalId: string;
  topic: string;
  durationMinutes: number;
  takeaways: string;
  sessionDate: string;
  createdAt: string;
}

export interface LearningGoal {
  id: string;
  skillName: string;
  description: string;
  currentLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  targetLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  startDate: string | null;
  targetDate: string | null;
  resources: Array<{ title: string; url: string }>;
  progress: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  sessions: LearningSession[];
  totalMinutes: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  entryDate: string;
  reflections: string;
  learnedToday: string;
  challenges: string;
  improvements: string;
  projectIdeas: string;
  achievementsText: string;
  linkedTaskId: string | null;
  linkedProjectId: string | null;
  linkedGoalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  type: 'deadline' | 'overdue' | 'reminder' | 'learning' | 'milestone' | 'streak';
  title: string;
  message: string;
  isRead: boolean;
  linkTab: NavTab;
  createdAt: string;
}

export interface DashboardOverviewData {
  todayKey: string;
  metrics: {
    totalTasks: number;
    completedToday: number;
    pendingTasks: number;
    overdueTasks: number;
    currentStreak: number;
    longestStreak: number;
    githubToday: number;
    githubYear: number;
    githubConnected: boolean;
    activeProjects: number;
    totalProjects: number;
    avgLearningProgress: number;
    totalLearningGoals: number;
  };
  weeklySeries: Array<{ date: string; day: string; completed: number; commitments: number }>;
  dailyProductivitySeries: Array<{ date: string; tasks: number; commitments: number }>;
  githubSummary: GitHubOverviewData['stats'];
  upcomingDeadlines: TaskItem[];
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    meta: string;
    status: string;
    timestamp: string;
  }>;
}

export interface AnalyticsData {
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgCompletionMinutes: number;
    mostProductiveDay: string;
    mostProductiveHour: string;
    weeklyConsistencyPct: number;
    monthlyConsistencyPct: number;
    learningHoursThisWeek: number;
    learningHoursThisMonth: number;
    projectStats: {
      total: number;
      completed: number;
      inProgress: number;
      planning: number;
    };
  };
  weekdaySeries: Array<{ day: string; count: number }>;
  thirtyDayTrend: Array<{
    date: string;
    fullDate: string;
    tasks: number;
    commitments: number;
    github: number;
    learningHours: number;
  }>;
  weeklyReport: {
    periodStart: string;
    periodEnd: string;
    accomplished: TaskItem[];
    incomplete: TaskItem[];
    githubContributions: number;
    learningHours: number;
    activeProjects: ProjectItem[];
    learningGoalsCount: number;
    areasToImprove: string[];
  };
}

export interface DailyMitItem {
  id: string;
  title: string;
  taskId?: string | null;
  completed: boolean;
}

export interface TomorrowTaskDraft {
  id: string;
  title: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  addedToTasks?: boolean;
}

export interface DailyPlanData {
  id: string;
  planDate: string;
  mits: DailyMitItem[];
  tomorrowTasks: TomorrowTaskDraft[];
  accomplishments: string;
  unfinishedNotes: string;
  challenges: string;
  isReviewed: boolean;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  projectId: string | null;
  mode: 'focus' | 'short_break' | 'long_break';
  plannedMinutes: number;
  actualSeconds: number;
  status: 'completed' | 'cancelled';
  notes: string;
  sessionDate: string;
  startedAt: string;
  completedAt: string | null;
  taskTitle?: string | null;
  projectName?: string | null;
}

export interface FocusDashboardData {
  todayKey: string;
  summary: {
    todayMinutes: number;
    weekMinutes: number;
    monthMinutes: number;
    totalCompletedSessions: number;
  };
  dailySeries: Array<{ date: string; fullDate: string; minutes: number }>;
  sessions: FocusSession[];
}

export interface WeeklyReportSnapshot {
  id: string;
  weekStart: string;
  weekEnd: string;
  tasksPlanned: number;
  tasksCompleted: number;
  completionPct: number;
  currentStreak: number;
  longestStreak: number;
  githubContributions: number;
  focusHours: string;
  learningHours: string;
  milestonesCompleted: number;
  improvementAreas: string[];
  reportData: {
    accomplishedTasks?: Array<{ id: string; title: string; categoryName: string; priority: string }>;
    unfinishedTasks?: Array<{ id: string; title: string; dueDate: string | null; priority: string }>;
    milestones?: Array<{ id: string; title: string; projectName: string }>;
  };
}

export interface JobApplication {
  id: string;
  company: string;
  roleTitle: string;
  status: 'Saved' | 'Applied' | 'Phone Screen' | 'Technical' | 'Final' | 'Offer' | 'Rejected';
  appliedDate: string | null;
  salaryRange: string;
  location: string;
  jobUrl: string;
  notes: string;
  updatedAt: string;
}

export interface InterviewPrepItem {
  id: string;
  applicationId: string | null;
  company: string;
  topic: string;
  category: 'DSA' | 'System Design' | 'Behavioral' | 'Domain';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'Planned' | 'Practiced' | 'Mastered';
  practiceDate: string;
  durationMinutes: number;
  feedback: string;
  improvementNotes: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  status: 'In Progress' | 'Earned' | 'Expired';
  earnedDate: string | null;
  expiryDate: string | null;
  credentialId: string;
  credentialUrl: string;
  notes: string;
}

export interface CareerMilestoneItem {
  id: string;
  title: string;
  targetDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string;
}

export interface CareerDashboardData {
  applications: JobApplication[];
  prepRecords: InterviewPrepItem[];
  certifications: CertificationItem[];
  milestones: CareerMilestoneItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: string;
}

