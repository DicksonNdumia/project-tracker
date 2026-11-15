import React, { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, Pause, Play, RotateCcw, Timer, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { FocusDashboardData, ProjectItem, TaskItem } from '../types';

interface FocusViewProps {
  refreshTrigger: number;
  onSessionCompleted: () => void;
}

type TimerMode = 'focus' | 'short_break' | 'long_break';

const MODE_PRESETS: Record<TimerMode, { label: string; minutes: number }> = {
  focus: { label: 'Focus (25m)', minutes: 25 },
  short_break: { label: 'Short Break (5m)', minutes: 5 },
  long_break: { label: 'Long Break (15m)', minutes: 15 },
};

export const FocusView: React.FC<FocusViewProps> = ({
  refreshTrigger,
  onSessionCompleted,
}) => {
  const [data, setData] = useState<FocusDashboardData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<TimerMode>('focus');
  const [customMinutes, setCustomMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [startedOnce, setStartedOnce] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [focusRes, tasksRes, projRes] = await Promise.all([
        apiFetch<FocusDashboardData>('/api/focus'),
        apiFetch<{ tasks: TaskItem[] }>('/api/tasks'),
        apiFetch<{ projects: ProjectItem[] }>('/api/projects'),
      ]);
      setData(focusRes);
      setTasks(
        tasksRes.tasks.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled')
      );
      setProjects(projRes.projects);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [refreshTrigger]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running]);

  // Auto-record session if timer hits 0 naturally
  useEffect(() => {
    if (secondsLeft === 0 && startedOnce && !saving) {
      handleCompleteSession(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const handleSelectMode = (nextMode: TimerMode) => {
    setRunning(false);
    setStartedOnce(false);
    setMode(nextMode);
    const mins = MODE_PRESETS[nextMode].minutes;
    setCustomMinutes(mins);
    setSecondsLeft(mins * 60);
    setFeedback(null);
  };

  const handleCustomMinutesChange = (val: string) => {
    const mins = Math.max(1, Math.min(180, Number(val) || 25));
    setCustomMinutes(mins);
    if (!running && !startedOnce) {
      setSecondsLeft(mins * 60);
    }
  };

  const handleReset = () => {
    setRunning(false);
    setStartedOnce(false);
    setSecondsLeft(customMinutes * 60);
    setFeedback(null);
  };

  const handleCompleteSession = async (autoFinished = false) => {
    setRunning(false);
    setSaving(true);
    setFeedback(null);
    const totalPlannedSeconds = customMinutes * 60;
    const elapsedSeconds = autoFinished
      ? totalPlannedSeconds
      : Math.max(60, totalPlannedSeconds - secondsLeft);

    try {
      await apiFetch('/api/focus', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          plannedMinutes: customMinutes,
          actualSeconds: elapsedSeconds,
          status: 'completed',
          taskId: selectedTaskId || null,
          projectId: selectedProjectId || null,
          notes,
        }),
      });
      setStartedOnce(false);
      setSecondsLeft(customMinutes * 60);
      setNotes('');
      setFeedback(
        `Recorded ${Math.round(elapsedSeconds / 60)}m ${
          mode === 'focus' ? 'deep focus' : 'break'
        } session.`
      );
      await loadAll();
      onSessionCompleted();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    await apiFetch(`/api/focus/${id}`, { method: 'DELETE' });
    await loadAll();
    onSessionCompleted();
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedClock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const pctRemaining =
    customMinutes > 0 ? Math.round((secondsLeft / (customMinutes * 60)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Focus Mode & Pomodoro</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Run distraction-free Pomodoro intervals linked to tasks and projects with historical time tracking.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Focus Today</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {((data?.summary.todayMinutes || 0) / 60).toFixed(1)}h
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {data?.summary.todayMinutes || 0} mins
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">This Week</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {((data?.summary.weekMinutes || 0) / 60).toFixed(1)}h
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {data?.summary.weekMinutes || 0} mins
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Last 30 Days</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {((data?.summary.monthMinutes || 0) / 60).toFixed(1)}h
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {data?.summary.monthMinutes || 0} mins
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Completed Sessions</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {data?.summary.totalCompletedSessions || 0}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Pomodoro intervals</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Timer Card */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full">
            {(Object.keys(MODE_PRESETS) as TimerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleSelectMode(m)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === m
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {MODE_PRESETS[m].label}
              </button>
            ))}
          </div>

          <div className="py-4 text-center">
            <div className="text-6xl font-semibold font-mono tabular-nums tracking-tight">
              {formattedClock}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden max-w-xs mx-auto">
              <div
                className={`h-full transition-all ${
                  mode === 'focus' ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${100 - pctRemaining}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            {!running ? (
              <button
                onClick={() => {
                  setStartedOnce(true);
                  setRunning(true);
                  setFeedback(null);
                }}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>{startedOnce ? 'Resume' : 'Start Focus'}</span>
              </button>
            ) : (
              <button
                onClick={() => setRunning(false)}
                className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={() => handleCompleteSession(false)}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Complete</span>
            </button>

            <button
              onClick={handleReset}
              className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Reset timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => handleCustomMinutesChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Link Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Link Task (optional)
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              >
                <option value="">General deep work</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Session Intent / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What will you ship in this block?"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            {feedback && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400">{feedback}</div>
            )}
          </div>
        </div>

        {/* Chart + Session History */}
        <div className="lg:col-span-3 space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">14-Day Focus Minutes</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Completed deep-work Pomodoro minutes per day
                </p>
              </div>
              <Timer className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.dailySeries || []}>
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
                  <Bar dataKey="minutes" name="Focus Minutes" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold mb-3">Recent Focus Sessions</h2>
            {loading && !data ? (
              <p className="text-xs text-slate-500">Loading sessions...</p>
            ) : !data?.sessions.length ? (
              <p className="text-xs text-slate-500 py-4">
                Start and complete a Pomodoro block to build your focus history.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
                {data.sessions.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {s.taskTitle || s.projectName || 'Deep Focus Block'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {s.sessionDate} · {s.mode.replace('_', ' ')} ·{' '}
                        <span className="font-mono tabular-nums">
                          {Math.round(s.actualSeconds / 60)}m
                        </span>
                        {s.projectName ? ` · ${s.projectName}` : ''}
                        {s.notes ? ` · ${s.notes}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSession(s.id)}
                      className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
