import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { DailyMitItem, DailyPlanData, TaskItem, TomorrowTaskDraft } from '../types';

interface DailyPlanningViewProps {
  refreshTrigger: number;
  onTasksChanged: () => void;
}

export const DailyPlanningView: React.FC<DailyPlanningViewProps> = ({
  refreshTrigger,
  onTasksChanged,
}) => {
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mits, setMits] = useState<DailyMitItem[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<TomorrowTaskDraft[]>([]);
  const [accomplishments, setAccomplishments] = useState('');
  const [unfinishedNotes, setUnfinishedNotes] = useState('');
  const [challenges, setChallenges] = useState('');
  const [isReviewed, setIsReviewed] = useState(false);

  const [recentPlans, setRecentPlans] = useState<DailyPlanData[]>([]);
  const [openTasks, setOpenTasks] = useState<TaskItem[]>([]);

  const [newMitTitle, setNewMitTitle] = useState('');
  const [selectedExistingTaskId, setSelectedExistingTaskId] = useState('');
  const [newTomorrowTitle, setNewTomorrowTitle] = useState('');
  const [newTomorrowPriority, setNewTomorrowPriority] =
    useState<TomorrowTaskDraft['priority']>('Medium');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (targetDate = planDate) => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, tasksRes] = await Promise.all([
        apiFetch<{
          planDate: string;
          plan: DailyPlanData;
          recentPlans: DailyPlanData[];
        }>(`/api/planning?date=${targetDate}`),
        apiFetch<{ tasks: TaskItem[] }>('/api/tasks'),
      ]);

      setMits(planRes.plan.mits || []);
      setTomorrowTasks(planRes.plan.tomorrowTasks || []);
      setAccomplishments(planRes.plan.accomplishments || '');
      setUnfinishedNotes(planRes.plan.unfinishedNotes || '');
      setChallenges(planRes.plan.challenges || '');
      setIsReviewed(Boolean(planRes.plan.isReviewed));
      setRecentPlans(planRes.recentPlans || []);
      setOpenTasks(
        tasksRes.tasks.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled')
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load daily plan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(planDate);
  }, [planDate, refreshTrigger]);

  const persistPlan = async (
    nextMits = mits,
    nextTomorrow = tomorrowTasks,
    nextReviewed = isReviewed
  ) => {
    setSaving(true);
    setStatusMsg(null);
    setError(null);
    try {
      const res = await apiFetch<{ plan: DailyPlanData }>(`/api/planning/${planDate}`, {
        method: 'PUT',
        body: JSON.stringify({
          mits: nextMits,
          tomorrowTasks: nextTomorrow,
          accomplishments,
          unfinishedNotes,
          challenges,
          isReviewed: nextReviewed,
        }),
      });
      setStatusMsg('Daily plan saved.');
      setRecentPlans((prev) => {
        const filtered = prev.filter((p) => p.planDate !== res.plan.planDate);
        return [res.plan, ...filtered].sort((a, b) => b.planDate.localeCompare(a.planDate));
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMit = async () => {
    if (mits.length >= 3) return;
    let title = newMitTitle.trim();
    let taskId: string | null = null;
    if (!title && selectedExistingTaskId) {
      const found = openTasks.find((t) => t.id === selectedExistingTaskId);
      if (found) {
        title = found.title;
        taskId = found.id;
      }
    }
    if (!title) return;

    const updated: DailyMitItem[] = [
      ...mits,
      { id: `mit-${Date.now()}`, title, taskId, completed: false },
    ];
    setMits(updated);
    setNewMitTitle('');
    setSelectedExistingTaskId('');
    await persistPlan(updated, tomorrowTasks, isReviewed);
  };

  const handleToggleMit = async (id: string) => {
    const updated = mits.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m));
    setMits(updated);
    await persistPlan(updated, tomorrowTasks, isReviewed);
  };

  const handleRemoveMit = async (id: string) => {
    const updated = mits.filter((m) => m.id !== id);
    setMits(updated);
    await persistPlan(updated, tomorrowTasks, isReviewed);
  };

  const handleAddTomorrow = async () => {
    if (!newTomorrowTitle.trim()) return;
    const updated: TomorrowTaskDraft[] = [
      ...tomorrowTasks,
      {
        id: `tmrw-${Date.now()}`,
        title: newTomorrowTitle.trim(),
        priority: newTomorrowPriority,
        addedToTasks: false,
      },
    ];
    setTomorrowTasks(updated);
    setNewTomorrowTitle('');
    await persistPlan(mits, updated, isReviewed);
  };

  const handleRemoveTomorrow = async (id: string) => {
    const updated = tomorrowTasks.filter((t) => t.id !== id);
    setTomorrowTasks(updated);
    await persistPlan(mits, updated, isReviewed);
  };

  const handlePromoteTomorrow = async () => {
    setPromoting(true);
    setError(null);
    setStatusMsg(null);
    try {
      await persistPlan(mits, tomorrowTasks, isReviewed);
      const res = await apiFetch<{ createdCount: number; scheduledDate: string; plan: DailyPlanData }>(
        `/api/planning/${planDate}/promote-tomorrow`,
        { method: 'POST' }
      );
      setTomorrowTasks(res.plan.tomorrowTasks || []);
      setStatusMsg(
        `Scheduled ${res.createdCount} task(s) to My Tasks for ${res.scheduledDate}.`
      );
      onTasksChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule tasks for tomorrow.');
    } finally {
      setPromoting(false);
    }
  };

  const mitCompletedCount = mits.filter((m) => m.completed).length;
  const unpromotedCount = tomorrowTasks.filter((t) => !t.addedToTasks).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Planning & Review</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define your 3 Most Important Tasks (MITs), capture your end-of-day review, and prep tomorrow.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
          />
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-xs text-slate-500">Loading daily plan...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1-2: MITs + End of Day Review + Tomorrow Plan */}
          <div className="lg:col-span-2 space-y-6">
            {/* 3 MITs */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Three Most Important Tasks (MITs)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    High-leverage outcomes that make today a win.
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {mitCompletedCount}/{mits.length || 3} complete
                </span>
              </div>

              <div className="space-y-2">
                {mits.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    No MITs locked in yet for {planDate}. Add up to 3 priorities below.
                  </div>
                ) : (
                  mits.map((m, idx) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    >
                      <button
                        onClick={() => handleToggleMit(m.id)}
                        className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <span
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            m.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {m.completed && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="text-xs font-mono text-slate-400 shrink-0">
                          #{idx + 1}
                        </span>
                        <span
                          className={`text-sm font-medium truncate ${
                            m.completed ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {m.title}
                        </span>
                      </button>
                      <button
                        onClick={() => handleRemoveMit(m.id)}
                        className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                        aria-label="Remove MIT"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {mits.length < 3 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newMitTitle}
                      onChange={(e) => setNewMitTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMit();
                        }
                      }}
                      placeholder={`Enter MIT #${mits.length + 1} or select an existing task...`}
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                    <select
                      value={selectedExistingTaskId}
                      onChange={(e) => setSelectedExistingTaskId(e.target.value)}
                      className="sm:w-52 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <option value="">Link open task (optional)</option>
                      {openTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMit}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add MIT</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* End-of-Day Review */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-semibold">End-of-Day Review</h2>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isReviewed}
                    onChange={(e) => setIsReviewed(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span className={isReviewed ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500'}>
                    Mark Day Reviewed
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Completed Accomplishments
                  </label>
                  <textarea
                    rows={3}
                    value={accomplishments}
                    onChange={(e) => setAccomplishments(e.target.value)}
                    placeholder="Key wins, PRs merged, problems solved..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Unfinished / Carryover Notes
                    </label>
                    <textarea
                      rows={3}
                      value={unfinishedNotes}
                      onChange={(e) => setUnfinishedNotes(e.target.value)}
                      placeholder="What slipped or needs follow-up?"
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Challenges & Blockers
                    </label>
                    <textarea
                      rows={3}
                      value={challenges}
                      onChange={(e) => setChallenges(e.target.value)}
                      placeholder="Distractions, technical bottlenecks, lessons..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{statusMsg}</span>
                <button
                  onClick={() => persistPlan(mits, tomorrowTasks, isReviewed)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Review'}</span>
                </button>
              </div>
            </div>

            {/* Plan Tasks for Tomorrow */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Plan Tasks for Tomorrow</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Stage tomorrow&apos;s queue and push directly into My Tasks.
                  </p>
                </div>
                {unpromotedCount > 0 && (
                  <button
                    onClick={handlePromoteTomorrow}
                    disabled={promoting}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{promoting ? 'Scheduling...' : `Schedule ${unpromotedCount} to My Tasks`}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTomorrowTitle}
                  onChange={(e) => setNewTomorrowTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTomorrow();
                    }
                  }}
                  placeholder="Task title for tomorrow..."
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <select
                  value={newTomorrowPriority}
                  onChange={(e) =>
                    setNewTomorrowPriority(e.target.value as TomorrowTaskDraft['priority'])
                  }
                  className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
                <button
                  onClick={handleAddTomorrow}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Add
                </button>
              </div>

              {tomorrowTasks.length > 0 && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {tomorrowTasks.map((t) => (
                    <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {t.priority} Priority ·{' '}
                          {t.addedToTasks ? 'Scheduled in My Tasks' : 'Staged'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTomorrow(t.id)}
                        className="text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Recent Plans History */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-fit space-y-4">
            <h2 className="text-sm font-semibold">Recent Daily Plans</h2>
            {recentPlans.length === 0 ? (
              <p className="text-xs text-slate-500">Saved daily plans will appear here.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {recentPlans.map((p) => {
                  const done = (p.mits || []).filter((m) => m.completed).length;
                  const total = (p.mits || []).length;
                  return (
                    <button
                      key={p.planDate}
                      onClick={() => setPlanDate(p.planDate)}
                      className={`w-full text-left py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                        p.planDate === planDate ? 'bg-slate-50 dark:bg-slate-800/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-medium">{p.planDate}</span>
                        {p.isReviewed && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Reviewed</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                        MITs: {done}/{total} · Tomorrow staged: {(p.tomorrowTasks || []).length}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
