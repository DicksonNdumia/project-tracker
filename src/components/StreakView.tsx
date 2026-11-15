import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Flame, ShieldCheck, Target, Trophy } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { StreakDashboardData } from '../types';

interface StreakViewProps {
  refreshTrigger: number;
  onProfileUpdated: () => void;
}

const MILESTONE_THRESHOLDS = [
  { days: 3, title: 'Ignition (3 Days)', reward: 'Three consecutive days of daily commitment focus.' },
  { days: 7, title: 'Momentum (7 Days)', reward: 'One full week of unbroken daily execution.' },
  { days: 14, title: 'Cadence (14 Days)', reward: 'Two consecutive weeks meeting your daily target.' },
  { days: 30, title: 'Discipline (30 Days)', reward: 'A full month of verified daily engineering output.' },
  { days: 100, title: 'Centurion (100 Days)', reward: '100 straight days of sustained developer consistency.' },
];

export const StreakView: React.FC<StreakViewProps> = ({
  refreshTrigger,
  onProfileUpdated,
}) => {
  const [data, setData] = useState<StreakDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetInput, setTargetInput] = useState('1');
  const [timezoneInput, setTimezoneInput] = useState('UTC');
  const [savingConfig, setSavingConfig] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStreaks = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StreakDashboardData>('/api/streaks');
      setData(res);
      setTargetInput(String(res.dailyTarget));
      setTimezoneInput(res.timezone);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStreaks();
  }, [refreshTrigger]);

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setMessage(null);
    try {
      const res = await apiFetch<StreakDashboardData>('/api/streaks/target', {
        method: 'PATCH',
        body: JSON.stringify({
          dailyCommitmentTarget: Number(targetInput) || 1,
          timezone: timezoneInput,
        }),
      });
      setData(res);
      onProfileUpdated();
      setMessage('Streak target and timezone updated.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Build 364-day (52 weeks) heatmap matrix ending today
  const heatmapWeeks = useMemo(() => {
    if (!data) return [];
    const historyMap = new Map(data.history.map((h) => [h.date, h]));
    const [y, m, d] = data.todayKey.split('-').map(Number);
    const todayDate = new Date(Date.UTC(y, m - 1, d));
    const endDayOfWeek = todayDate.getUTCDay();
    const totalDays = 52 * 7 + endDayOfWeek + 1;
    const startDate = new Date(todayDate);
    startDate.setUTCDate(startDate.getUTCDate() - (totalDays - 1));

    const weeks: Array<
      Array<{ dateKey: string; commitments: number; tasks: number; isSuccess: boolean }>
    > = [];

    let currentWeek: Array<{
      dateKey: string;
      commitments: number;
      tasks: number;
      isSuccess: boolean;
    }> = [];

    for (let i = 0; i < totalDays; i++) {
      const dt = new Date(startDate);
      dt.setUTCDate(startDate.getUTCDate() + i);
      const key = dt.toISOString().slice(0, 10);
      const row = historyMap.get(key);
      currentWeek.push({
        dateKey: key,
        commitments: row?.commitmentsCompleted || 0,
        tasks: row?.tasksCompleted || 0,
        isSuccess: Boolean(row?.isSuccess),
      });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  }, [data]);

  if (loading && !data) {
    return <div className="p-8 text-xs text-slate-500">Calculating consistency history...</div>;
  }
  if (!data) return null;

  const current = data.summary.currentStreak;
  const encouragingMessage =
    current >= 100
      ? 'Centurion milestone achieved. Your daily execution habit is rock solid.'
      : current >= 30
        ? '30+ days of unbroken discipline. Keep protecting your daily commitment window.'
        : current >= 14
          ? 'Two weeks strong. Consistency compounds into long-term mastery.'
          : current >= 7
            ? '7-day streak active! You completed a full week of daily commitments.'
            : current >= 3
              ? '3-day streak ignited. Stay focused on today’s required commitments.'
              : data.todayProgress.isSuccess
                ? 'Today’s commitment target is satisfied. Come back tomorrow to extend your streak.'
                : `Complete ${Math.max(
                    0,
                    data.dailyTarget - data.todayProgress.commitmentsCompleted
                  )} more daily commitment task(s) today to build your streak.`;

  const unlockedCodes = new Set(data.achievements.map((a) => a.code));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Streak & Consistency Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Daily streaks require completing tasks explicitly marked as Daily Commitments.
          </p>
        </div>
      </div>

      {/* Encouragement & Today Progress */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">{encouragingMessage}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Today ({data.todayKey} · {data.timezone}):{' '}
              {data.todayProgress.commitmentsCompleted}/{data.dailyTarget} commitments completed
            </div>
          </div>
        </div>
        <div className="text-xs font-medium shrink-0">
          {data.todayProgress.isSuccess ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Today Verified</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Target className="w-4 h-4" />
              <span>In Progress</span>
            </span>
          )}
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Current Streak</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {data.summary.currentStreak} days
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Longest Streak</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {data.summary.longestStreak} days
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Total Active Days</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {data.summary.totalActiveDays}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Weekly Consistency</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {data.weeklyConsistencyPct}%
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">Monthly Consistency</div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums">
            {data.monthlyConsistencyPct}%
          </div>
        </div>
      </div>

      {/* Consistency Heatmap */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Annual Commitment Heatmap</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              52-week history of verified daily commitment days
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Missed</span>
            <span className="w-3 h-3 rounded-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
            <span className="w-3 h-3 rounded-xs bg-emerald-200 dark:bg-emerald-900" />
            <span className="w-3 h-3 rounded-xs bg-emerald-400 dark:bg-emerald-700" />
            <span className="w-3 h-3 rounded-xs bg-emerald-600 dark:bg-emerald-500" />
            <span>Target Met</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-flex gap-1">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day) => {
                  const colorClass = day.isSuccess
                    ? day.commitments >= data.dailyTarget + 2
                      ? 'bg-emerald-600 dark:bg-emerald-500'
                      : 'bg-emerald-400 dark:bg-emerald-600'
                    : day.tasks > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300/60 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800/80';
                  return (
                    <div
                      key={day.dateKey}
                      title={`${day.dateKey}: ${day.commitments} commitments, ${day.tasks} tasks`}
                      className={`w-3 h-3 rounded-[2px] ${colorClass}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Achievement Badges */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Consistency Milestones</h2>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MILESTONE_THRESHOLDS.map((m) => {
              const unlocked =
                unlockedCodes.has(`STREAK_${m.days}`) || data.summary.longestStreak >= m.days;
              return (
                <div
                  key={m.days}
                  className={`p-3.5 rounded-lg border flex items-start gap-3 ${
                    unlocked
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-70'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      unlocked
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {unlocked ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <Award className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{m.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {m.reward}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak Rules & Configuration */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold">Commitment Target & Timezone</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure how many daily commitment tasks are required per day in your local timezone.
          </p>

          <form onSubmit={handleSaveTarget} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Daily Commitment Target
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Timezone (IANA)
              </label>
              <select
                value={timezoneInput}
                onChange={(e) => setTimezoneInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              >
                {[
                  'UTC',
                  'America/Los_Angeles',
                  'America/New_York',
                  'America/Chicago',
                  'Europe/London',
                  'Europe/Berlin',
                  'Africa/Nairobi',
                  'Asia/Tokyo',
                  'Asia/Kolkata',
                  'Australia/Sydney',
                ].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {message && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400">{message}</div>
            )}

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
            >
              {savingConfig ? 'Updating...' : 'Save Streak Settings'}
            </button>
          </form>
        </div>
      </div>

      {/* Historical Completion Log */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h2 className="text-sm font-semibold mb-3">Daily Completion History</h2>
        {data.history.length === 0 ? (
          <p className="text-xs text-slate-500">No daily records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Commitments</th>
                  <th className="py-2 pr-4 font-medium">All Tasks Completed</th>
                  <th className="py-2 font-medium text-right">Streak Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {data.history.slice(0, 14).map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">{row.date}</td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {row.commitmentsCompleted} / {row.commitmentsTarget}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">{row.tasksCompleted}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={
                          row.isSuccess
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {row.isSuccess ? 'Verified' : 'Missed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
