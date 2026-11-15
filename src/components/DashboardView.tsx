import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flame,
  FolderKanban,
  GitCommitHorizontal,
  GraduationCap,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DashboardOverviewData, NavTab } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  onOpenQuickTask: () => void;
  refreshTrigger: number;
  onWorkspaceSeeded: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickTask,
  refreshTrigger,
  onWorkspaceSeeded,
}) => {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardOverviewData>('/api/dashboard/overview');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [refreshTrigger]);

  const handleSeedStarter = async () => {
    setSeeding(true);
    try {
      await apiFetch('/api/dashboard/seed-starter', { method: 'POST' });
      onWorkspaceSeeded();
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load starter workspace.');
    } finally {
      setSeeding(false);
    }
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!data) return null;
  const m = data.metrics;
  const isWorkspaceEmpty =
    m.totalTasks === 0 && m.totalProjects === 0 && m.totalLearningGoals === 0;

  return (
    <div className="space-y-8">
      {/* Greeting & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {todayFormatted}
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
            {greeting}, {profile?.displayName || 'Developer'}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {isWorkspaceEmpty && (
            <button
              onClick={handleSeedStarter}
              disabled={seeding}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>{seeding ? 'Loading...' : 'Load Starter Workspace'}</span>
            </button>
          )}
          <button
            onClick={onOpenQuickTask}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Add Task</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Tasks Completed Today</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {m.completedToday}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {m.totalTasks} total created
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Pending & Overdue</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums">{m.pendingTasks}</span>
            <span className="text-xs font-mono tabular-nums text-red-600 dark:text-red-400">
              {m.overdueTasks} overdue
            </span>
          </div>
          <button
            onClick={() => onNavigate('tasks')}
            className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Open task queue
          </button>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Daily Streak</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {m.currentStreak}d
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Longest: {m.longestStreak}d
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>GitHub Activity</span>
            <GitCommitHorizontal className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {m.githubConnected ? m.githubToday : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {m.githubConnected ? `${m.githubYear} this year` : 'Not connected'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Projects & Skills</span>
            <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {m.activeProjects}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5">
              active
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Learning avg: {m.avgLearningProgress}%
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Daily Productivity (14 Days)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks completed vs daily commitments satisfied
              </p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyProductivitySeries}>
                <defs>
                  <linearGradient id="tasksGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: 8,
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tasks"
                  name="Tasks Completed"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#tasksGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="commitments"
                  name="Commitments"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">Weekly Task Completion</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rolling 7-day breakdown by weekday
              </p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: 8,
                    color: '#f8fafc',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="completed" name="Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="commitments"
                  name="Daily Commitments"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Summary Grid: GitHub Summary + Upcoming Deadlines + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GitHub Contribution Summary */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">GitHub Contribution Summary</h2>
              <button
                onClick={() => onNavigate('github')}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Details</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {m.githubConnected ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/70">
                  <div className="text-xs text-slate-500">This Week</div>
                  <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                    {data.githubSummary.thisWeek}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/70">
                  <div className="text-xs text-slate-500">This Month</div>
                  <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                    {data.githubSummary.thisMonth}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/70">
                  <div className="text-xs text-slate-500">Coding Streak</div>
                  <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                    {data.githubSummary.currentStreak}d
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/70">
                  <div className="text-xs text-slate-500">Public Repos</div>
                  <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                    {data.githubSummary.publicRepos}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Connect your GitHub account via OAuth to automatically track commits, pull
                  requests, issues, and your contribution heatmap.
                </p>
                <button
                  onClick={() => onNavigate('github')}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium cursor-pointer"
                >
                  Connect GitHub
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5" />
              <span>{m.totalProjects} documented projects</span>
            </span>
            <button
              onClick={() => onNavigate('projects')}
              className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Portfolio
            </button>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Upcoming Deadlines</h2>
            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>
          {data.upcomingDeadlines.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No pending tasks with due dates.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.upcomingDeadlines.map((t) => {
                const isOverdue = Boolean(t.dueDate && t.dueDate < data.todayKey);
                return (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.categoryName} · {t.priority}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono tabular-nums shrink-0 ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400 font-medium'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {t.dueDate}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Activity</h2>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          {data.recentActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Activity will appear here as you create and complete tasks.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.recentActivities.slice(0, 6).map((act) => (
                <div key={act.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{act.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{act.meta}</div>
                  </div>
                  <span
                    className={`text-xs shrink-0 ${
                      act.status === 'Completed'
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {act.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
