import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BookOpen, Clock, Edit3, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { LearningGoal, LearningSession } from '../types';

interface LearningViewProps {
  globalSearch: string;
  refreshTrigger: number;
  onLearningChanged: () => void;
}

const PRESET_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'C#',
  'ASP.NET Core',
  'SQL',
  'PostgreSQL',
  'Docker',
  'Microsoft Azure',
];

const LEVELS: LearningGoal['currentLevel'][] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];

export const LearningView: React.FC<LearningViewProps> = ({
  globalSearch,
  refreshTrigger,
  onLearningChanged,
}) => {
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<LearningGoal | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionGoalId, setSessionGoalId] = useState('');

  // Goal form
  const [skillName, setSkillName] = useState('');
  const [description, setDescription] = useState('');
  const [currentLevel, setCurrentLevel] = useState<LearningGoal['currentLevel']>('Beginner');
  const [targetLevel, setTargetLevel] = useState<LearningGoal['targetLevel']>('Advanced');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [progress, setProgress] = useState('0');
  const [resourcesText, setResourcesText] = useState('');
  const [notes, setNotes] = useState('');

  // Session form
  const [topic, setTopic] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [takeaways, setTakeaways] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));

  const loadLearning = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ goals: LearningGoal[]; sessions: LearningSession[] }>(
        '/api/learning'
      );
      setGoals(res.goals);
      setSessions(res.sessions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLearning();
  }, [refreshTrigger]);

  const openGoalEditor = (g: LearningGoal | null) => {
    setEditingGoal(g);
    if (g) {
      setSkillName(g.skillName);
      setDescription(g.description);
      setCurrentLevel(g.currentLevel);
      setTargetLevel(g.targetLevel);
      setStartDate(g.startDate || '');
      setTargetDate(g.targetDate || '');
      setProgress(String(g.progress));
      setResourcesText(
        (g.resources || []).map((r) => `${r.title} | ${r.url}`).join('\n')
      );
      setNotes(g.notes || '');
    } else {
      setSkillName('');
      setDescription('');
      setCurrentLevel('Beginner');
      setTargetLevel('Advanced');
      setStartDate(new Date().toISOString().slice(0, 10));
      setTargetDate('');
      setProgress('10');
      setResourcesText('');
      setNotes('');
    }
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) return;
    const resources = resourcesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, url] = line.split('|').map((s) => s.trim());
        return { title: title || url || 'Resource', url: url || title || '' };
      });

    const payload = {
      skillName: skillName.trim(),
      description,
      currentLevel,
      targetLevel,
      startDate: startDate || null,
      targetDate: targetDate || null,
      progress: Number(progress) || 0,
      resources,
      notes,
    };

    if (editingGoal) {
      await apiFetch(`/api/learning/goals/${editingGoal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/learning/goals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    setGoalModalOpen(false);
    await loadLearning();
    onLearningChanged();
  };

  const handleDeleteGoal = async (id: string) => {
    await apiFetch(`/api/learning/goals/${id}`, { method: 'DELETE' });
    await loadLearning();
    onLearningChanged();
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionGoalId || !topic.trim()) return;
    await apiFetch('/api/learning/sessions', {
      method: 'POST',
      body: JSON.stringify({
        goalId: sessionGoalId,
        topic: topic.trim(),
        durationMinutes: Number(durationMinutes) || 30,
        takeaways,
        sessionDate,
      }),
    });
    setTopic('');
    setTakeaways('');
    setSessionModalOpen(false);
    await loadLearning();
    onLearningChanged();
  };

  const handleDeleteSession = async (id: string) => {
    await apiFetch(`/api/learning/sessions/${id}`, { method: 'DELETE' });
    await loadLearning();
  };

  const query = globalSearch.trim().toLowerCase();
  const filteredGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          !query ||
          g.skillName.toLowerCase().includes(query) ||
          g.description.toLowerCase().includes(query)
      ),
    [goals, query]
  );

  const chartData = useMemo(
    () =>
      goals.map((g) => ({
        skill: g.skillName,
        hours: Number((g.totalMinutes / 60).toFixed(1)),
        progress: g.progress,
      })),
    [goals]
  );

  const totalHours = (
    sessions.reduce((acc, s) => acc + s.durationMinutes, 0) / 60
  ).toFixed(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Learning & Skill Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track proficiency milestones, learning resources, and logged study hours.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {goals.length > 0 && (
            <button
              onClick={() => {
                setSessionGoalId(goals[0].id);
                setSessionModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Log Study Session</span>
            </button>
          )}
          <button
            onClick={() => openGoalEditor(null)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Learning Goal</span>
          </button>
        </div>
      </div>

      {/* Overview Stats & Progress Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold">Skill Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">Active Skills</div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums">
                {goals.length}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500">Total Logged</div>
              <div className="mt-1 text-xl font-semibold font-mono tabular-nums">
                {totalHours}h
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total study sessions recorded:{' '}
            <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
              {sessions.length}
            </span>
          </div>
        </div>

        <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold mb-3">Progress & Hours by Skill</h2>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              Add a learning goal to visualize progress.
            </div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                  <XAxis dataKey="skill" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: 8,
                      color: '#f8fafc',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="progress" name="Progress %" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="p-8 text-xs text-slate-500">Loading learning goals...</div>
      ) : filteredGoals.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-8 h-8 mx-auto text-slate-400" />
          <div className="mt-2 text-sm font-medium">No learning goals yet</div>
          <p className="mt-1 text-xs text-slate-500">
            Track skills like TypeScript, PostgreSQL, Docker, or Microsoft Azure.
          </p>
          <button
            onClick={() => openGoalEditor(null)}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
          >
            Create First Learning Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredGoals.map((g) => (
            <div
              key={g.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {g.currentLevel} → {g.targetLevel}
                    {g.targetDate ? ` · Target ${g.targetDate}` : ''}
                  </div>
                  <h3 className="mt-1 text-base font-semibold">{g.skillName}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setSessionGoalId(g.id);
                      setSessionModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    + Session
                  </button>
                  <button
                    onClick={() => openGoalEditor(g)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(g.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {g.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400">{g.description}</p>
              )}

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 font-mono tabular-nums">
                    {(g.totalMinutes / 60).toFixed(1)}h logged ({g.sessions.length} sessions)
                  </span>
                  <span className="font-mono tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                    {g.progress}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${g.progress}%` }}
                  />
                </div>
              </div>

              {g.resources?.length > 0 && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {g.resources.map((r, idx) => (
                    <a
                      key={idx}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <span>{r.title}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}

              {g.sessions?.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-medium text-slate-500">Recent Sessions</div>
                  {g.sessions.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start justify-between gap-2 text-xs text-slate-600 dark:text-slate-400"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {s.topic}
                        </div>
                        {s.takeaways && <div className="truncate">{s.takeaways}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                        <span>{s.durationMinutes}m</span>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Goal Modal */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold">
                {editingGoal ? 'Edit Learning Goal' : 'New Learning Goal'}
              </h2>
              <button
                onClick={() => setGoalModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveGoal} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Skill Name
                </label>
                <input
                  type="text"
                  list="preset-skills"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="e.g., PostgreSQL, TypeScript, Docker"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
                <datalist id="preset-skills">
                  {PRESET_SKILLS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Current</label>
                  <select
                    value={currentLevel}
                    onChange={(e) =>
                      setCurrentLevel(e.target.value as LearningGoal['currentLevel'])
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Target</label>
                  <select
                    value={targetLevel}
                    onChange={(e) =>
                      setTargetLevel(e.target.value as LearningGoal['targetLevel'])
                    }
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Progress %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Learning Resources (Title | URL per line)
                </label>
                <textarea
                  rows={2}
                  value={resourcesText}
                  onChange={(e) => setResourcesText(e.target.value)}
                  placeholder="PostgreSQL Docs | https://www.postgresql.org/docs/"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                >
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold">Log Learning Session</h2>
              <button
                onClick={() => setSessionModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSession} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Skill</label>
                <select
                  value={sessionGoalId}
                  onChange={(e) => setSessionGoalId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.skillName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Topic Covered
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Minutes Spent
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Key Takeaways
                </label>
                <textarea
                  rows={2}
                  value={takeaways}
                  onChange={(e) => setTakeaways(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
