import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileDown,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { exportWeeklyReportPdf } from '../lib/exportPdf';
import { AnalyticsData, WeeklyReportSnapshot } from '../types';

interface AnalyticsViewProps {
  refreshTrigger: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ refreshTrigger }) => {
  const { profile } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [reportsHistory, setReportsHistory] = useState<WeeklyReportSnapshot[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshingReport, setRefreshingReport] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, historyRes] = await Promise.all([
        apiFetch<AnalyticsData>('/api/dashboard/analytics'),
        apiFetch<{ reports: WeeklyReportSnapshot[] }>('/api/reports/weekly/history'),
      ]);
      setData(analyticsRes);
      setReportsHistory(historyRes.reports || []);
      if (historyRes.reports?.length && !selectedWeekStart) {
        setSelectedWeekStart(historyRes.reports[0].weekStart);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [refreshTrigger]);

  const handleRefreshWeekReport = async () => {
    if (!selectedWeekStart) return;
    setRefreshingReport(true);
    try {
      const res = await apiFetch<{ report: WeeklyReportSnapshot }>(
        `/api/reports/weekly?weekStart=${selectedWeekStart}`
      );
      setReportsHistory((prev) =>
        prev.map((r) => (r.weekStart === res.report.weekStart ? res.report : r))
      );
    } finally {
      setRefreshingReport(false);
    }
  };

  if (loading && !data) {
    return <div className="p-8 text-xs text-slate-500">Generating productivity analytics...</div>;
  }
  if (!data) return null;

  const s = data.summary;
  const w = data.weeklyReport;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics & Weekly Report</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Completion rates, peak productivity windows, GitHub trends, and weekly review.
        </p>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Completion Rate</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {s.completionRate}%
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {s.completedTasks}/{s.totalTasks} tasks
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Avg Task Duration</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {s.avgCompletionMinutes}m
          </div>
          <div className="text-xs text-slate-500 mt-0.5">per completed task</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Peak Day</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono">{s.mostProductiveDay}</div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            Peak hr: {s.mostProductiveHour}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Consistency (7d / 30d)</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {s.weeklyConsistencyPct}%
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            30d: {s.monthlyConsistencyPct}%
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Learning Hours</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {s.learningHoursThisWeek}h
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            30d: {s.learningHoursThisMonth}h
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Projects Completed</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {s.projectStats.completed} / {s.projectStats.total}
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {s.projectStats.inProgress} in progress
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">30-Day Multi-Signal Velocity</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks completed, GitHub contributions, and learning hours
              </p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.thirtyDayTrend}>
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
                <Line
                  type="monotone"
                  dataKey="tasks"
                  name="Tasks Completed"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="github"
                  name="GitHub Contributions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="learningHours"
                  name="Learning Hours"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold mb-1">Most Productive Days</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Completed tasks distribution by weekday
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekdaySeries}>
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
                <Bar dataKey="count" name="Completed Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Weekly Summary Report */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-semibold">Weekly Summary Report</h2>
            <div className="text-xs font-mono text-slate-500">
              {w.periodStart} → {w.periodEnd}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            GitHub: {w.githubContributions} contributions · Learning: {w.learningHours}h · Active
            Projects: {w.activeProjects.length}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>What You Accomplished ({w.accomplished.length})</span>
            </div>
            {w.accomplished.length === 0 ? (
              <p className="text-xs text-slate-500">No tasks completed in this 7-day window.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {w.accomplished.map((t) => (
                  <li key={t.id} className="truncate">
                    · {t.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>Incomplete / Carried Over ({w.incomplete.length})</span>
            </div>
            {w.incomplete.length === 0 ? (
              <p className="text-xs text-slate-500">All scheduled items for this week completed.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {w.incomplete.map((t) => (
                  <li key={t.id} className="truncate">
                    · {t.title} ({t.dueDate})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-blue-500" />
              <span>Focus & Improvement Areas</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              {w.areasToImprove.map((item, i) => (
                <li key={i}>· {item}</li>
              ))}
            </ul>
            {w.activeProjects.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-medium">Active Projects: </span>
                {w.activeProjects.map((p) => `${p.name} (${p.progress}%)`).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historical Weekly Performance Reports Archive */}
      {reportsHistory.length > 0 && (() => {
        const activeReport =
          reportsHistory.find((r) => r.weekStart === selectedWeekStart) || reportsHistory[0];
        return (
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-semibold">Archived Weekly Performance Reports</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Browse auto-generated weekly snapshots across streaks, focus hours, GitHub, and milestones.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={activeReport.weekStart}
                  onChange={(e) => setSelectedWeekStart(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                >
                  {reportsHistory.map((rep) => (
                    <option key={rep.weekStart} value={rep.weekStart}>
                      {rep.weekStart} → {rep.weekEnd}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRefreshWeekReport}
                  disabled={refreshingReport}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingReport ? 'animate-spin' : ''}`} />
                  <span>Recalculate</span>
                </button>
                <button
                  onClick={() => exportWeeklyReportPdf(activeReport, profile?.displayName || 'Developer')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {[
                ['Tasks Planned / Done', `${activeReport.tasksCompleted}/${activeReport.tasksPlanned}`],
                ['Completion Rate', `${activeReport.completionPct}%`],
                ['Streaks (Cur / Max)', `${activeReport.currentStreak}d / ${activeReport.longestStreak}d`],
                ['GitHub Contribs', activeReport.githubContributions],
                ['Focus Hours', `${activeReport.focusHours}h`],
                ['Learning Hours', `${activeReport.learningHours}h`],
                ['Milestones Done', activeReport.milestonesCompleted],
              ].map(([label, val]) => (
                <div
                  key={String(label)}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-[11px] text-slate-500">{label}</div>
                  <div className="mt-1 text-base font-semibold font-mono tabular-nums">{val}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Areas Needing Improvement
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {activeReport.improvementAreas.map((area, idx) => (
                    <li key={idx}>· {area}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Completed Milestones ({activeReport.reportData?.milestones?.length || 0})
                </div>
                {!activeReport.reportData?.milestones?.length ? (
                  <p className="text-xs text-slate-500">No project milestones closed this week.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {activeReport.reportData.milestones.map((m) => (
                      <li key={m.id}>
                        · {m.projectName}: {m.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
