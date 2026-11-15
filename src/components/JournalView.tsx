import React, { useEffect, useMemo, useState } from 'react';
import { BookText, Edit3, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { JournalEntry, LearningGoal, ProjectItem, TaskItem } from '../types';

interface JournalViewProps {
  globalSearch: string;
  refreshTrigger: number;
}

export const JournalView: React.FC<JournalViewProps> = ({
  globalSearch,
  refreshTrigger,
}) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);

  const [title, setTitle] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [reflections, setReflections] = useState('');
  const [learnedToday, setLearnedToday] = useState('');
  const [challenges, setChallenges] = useState('');
  const [improvements, setImprovements] = useState('');
  const [projectIdeas, setProjectIdeas] = useState('');
  const [achievementsText, setAchievementsText] = useState('');
  const [linkedTaskId, setLinkedTaskId] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [linkedGoalId, setLinkedGoalId] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [jRes, tRes, pRes, lRes] = await Promise.all([
        apiFetch<{ entries: JournalEntry[] }>('/api/journal'),
        apiFetch<{ tasks: TaskItem[] }>('/api/tasks'),
        apiFetch<{ projects: ProjectItem[] }>('/api/projects'),
        apiFetch<{ goals: LearningGoal[] }>('/api/learning'),
      ]);
      setEntries(jRes.entries);
      setTasks(tRes.tasks);
      setProjects(pRes.projects);
      setGoals(lRes.goals);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [refreshTrigger]);

  const openEditor = (entry: JournalEntry | null) => {
    setEditing(entry);
    if (entry) {
      setTitle(entry.title);
      setEntryDate(entry.entryDate);
      setReflections(entry.reflections || '');
      setLearnedToday(entry.learnedToday || '');
      setChallenges(entry.challenges || '');
      setImprovements(entry.improvements || '');
      setProjectIdeas(entry.projectIdeas || '');
      setAchievementsText(entry.achievementsText || '');
      setLinkedTaskId(entry.linkedTaskId || '');
      setLinkedProjectId(entry.linkedProjectId || '');
      setLinkedGoalId(entry.linkedGoalId || '');
    } else {
      setTitle('');
      setEntryDate(new Date().toISOString().slice(0, 10));
      setReflections('');
      setLearnedToday('');
      setChallenges('');
      setImprovements('');
      setProjectIdeas('');
      setAchievementsText('');
      setLinkedTaskId('');
      setLinkedProjectId('');
      setLinkedGoalId('');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      entryDate,
      reflections,
      learnedToday,
      challenges,
      improvements,
      projectIdeas,
      achievementsText,
      linkedTaskId: linkedTaskId || null,
      linkedProjectId: linkedProjectId || null,
      linkedGoalId: linkedGoalId || null,
    };

    if (editing) {
      await apiFetch(`/api/journal/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/journal', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    await loadAll();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/journal/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g.skillName])), [goals]);

  const query = globalSearch.trim().toLowerCase();
  const filteredEntries = entries.filter((e) => {
    if (!query) return true;
    return (
      e.title.toLowerCase().includes(query) ||
      (e.reflections || '').toLowerCase().includes(query) ||
      (e.learnedToday || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes & Personal Journal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Capture reflections, engineering lessons, ideas, and link notes to tasks or projects.
          </p>
        </div>
        <button
          onClick={() => openEditor(null)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Journal Entry</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-xs text-slate-500">Loading journal entries...</div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <BookText className="w-8 h-8 mx-auto text-slate-400" />
          <div className="mt-2 text-sm font-medium">No journal entries yet</div>
          <p className="mt-1 text-xs text-slate-500">
            Record daily engineering reflections, breakthroughs, and project ideas.
          </p>
          <button
            onClick={() => openEditor(null)}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
          >
            Write First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => {
            const links = [
              entry.linkedTaskId ? `Task: ${taskMap.get(entry.linkedTaskId) || 'Linked'}` : null,
              entry.linkedProjectId
                ? `Project: ${projectMap.get(entry.linkedProjectId) || 'Linked'}`
                : null,
              entry.linkedGoalId ? `Skill: ${goalMap.get(entry.linkedGoalId) || 'Linked'}` : null,
            ].filter(Boolean);

            return (
              <article
                key={entry.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-slate-500">{entry.entryDate}</div>
                    <h2 className="mt-0.5 text-base font-semibold">{entry.title}</h2>
                    {links.length > 0 && (
                      <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                        {links.join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditor(entry)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {entry.reflections && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        Daily Reflections
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {entry.reflections}
                      </p>
                    </div>
                  )}
                  {entry.learnedToday && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        What I Learned Today
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {entry.learnedToday}
                      </p>
                    </div>
                  )}
                  {entry.challenges && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        Challenges Encountered
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {entry.challenges}
                      </p>
                    </div>
                  )}
                  {entry.improvements && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        Things to Improve
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {entry.improvements}
                      </p>
                    </div>
                  )}
                  {entry.projectIdeas && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        Future Project Ideas
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {entry.projectIdeas}
                      </p>
                    </div>
                  )}
                  {entry.achievementsText && (
                    <div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        Personal Achievements
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                        {entry.achievementsText}
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold">
                {editing ? 'Edit Journal Entry' : 'New Journal Entry'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Daily Reflections
                  </label>
                  <textarea
                    rows={2}
                    value={reflections}
                    onChange={(e) => setReflections(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    What I Learned Today
                  </label>
                  <textarea
                    rows={2}
                    value={learnedToday}
                    onChange={(e) => setLearnedToday(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Challenges Encountered
                  </label>
                  <textarea
                    rows={2}
                    value={challenges}
                    onChange={(e) => setChallenges(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Things to Improve
                  </label>
                  <textarea
                    rows={2}
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Future Project Ideas
                  </label>
                  <textarea
                    rows={2}
                    value={projectIdeas}
                    onChange={(e) => setProjectIdeas(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Personal Achievements
                  </label>
                  <textarea
                    rows={2}
                    value={achievementsText}
                    onChange={(e) => setAchievementsText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Link Task
                  </label>
                  <select
                    value={linkedTaskId}
                    onChange={(e) => setLinkedTaskId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <option value="">None</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Link Project
                  </label>
                  <select
                    value={linkedProjectId}
                    onChange={(e) => setLinkedProjectId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Link Skill Goal
                  </label>
                  <select
                    value={linkedGoalId}
                    onChange={(e) => setLinkedGoalId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <option value="">None</option>
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.skillName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
