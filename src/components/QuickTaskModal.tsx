import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { ProjectItem, TaskCategory, TaskItem } from '../types';

interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, taskId?: string) => Promise<void>;
  editingTask?: TaskItem | null;
  defaultDate?: string;
  categories: TaskCategory[];
  projects?: ProjectItem[];
  availableTasks?: TaskItem[];
}

export const QuickTaskModal: React.FC<QuickTaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTask,
  defaultDate,
  categories,
  projects = [],
  availableTasks = [],
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState('Engineering');
  const [priority, setPriority] = useState<TaskItem['priority']>('Medium');
  const [status, setStatus] = useState<TaskItem['status']>('Pending');
  const [isDailyCommitment, setIsDailyCommitment] = useState(false);
  const [recurrence, setRecurrence] = useState<TaskItem['recurrence']>('None');
  const [startDate, setStartDate] = useState(defaultDate || today);
  const [dueDate, setDueDate] = useState(defaultDate || today);
  const [estimatedMinutes, setEstimatedMinutes] = useState('30');
  const [actualMinutes, setActualMinutes] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dependsOnTaskId, setDependsOnTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [subtaskDrafts, setSubtaskDrafts] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setCategoryName(editingTask.categoryName || 'Engineering');
      setPriority(editingTask.priority);
      setStatus(editingTask.status);
      setIsDailyCommitment(editingTask.isDailyCommitment);
      setRecurrence(editingTask.recurrence);
      setStartDate(editingTask.startDate || today);
      setDueDate(editingTask.dueDate || today);
      setEstimatedMinutes(String(editingTask.estimatedMinutes ?? 30));
      setActualMinutes(editingTask.actualMinutes != null ? String(editingTask.actualMinutes) : '');
      setProjectId(editingTask.projectId || '');
      setDependsOnTaskId(editingTask.dependsOnTaskId || '');
      setNotes(editingTask.notes || '');
      setSubtaskDrafts([]);
    } else {
      setTitle('');
      setDescription('');
      setCategoryName(categories[0]?.name || 'Engineering');
      setPriority('Medium');
      setStatus('Pending');
      setIsDailyCommitment(false);
      setRecurrence('None');
      setStartDate(defaultDate || today);
      setDueDate(defaultDate || today);
      setEstimatedMinutes('30');
      setActualMinutes('');
      setProjectId('');
      setDependsOnTaskId('');
      setNotes('');
      setSubtaskDrafts([]);
    }
    setError(null);
    setNewSubtask('');
  }, [editingTask, defaultDate, isOpen, categories, today]);

  if (!isOpen) return null;

  const handleAddSubtaskDraft = () => {
    if (!newSubtask.trim()) return;
    setSubtaskDrafts((prev) => [...prev, newSubtask.trim()]);
    setNewSubtask('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a task title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: title.trim(),
          description,
          categoryName,
          priority,
          status,
          isDailyCommitment,
          recurrence,
          startDate: startDate || null,
          dueDate: dueDate || null,
          estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : 30,
          actualMinutes: actualMinutes ? Number(actualMinutes) : null,
          projectId: projectId || null,
          dependsOnTaskId: dependsOnTaskId || null,
          notes,
          ...(editingTask ? {} : { subtasks: subtaskDrafts }),
        },
        editingTask?.id
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold">
            {editingTask ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement PostgreSQL streak boundary tests"
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, acceptance criteria, or context..."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Category
              </label>
              <select
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              >
                {Array.from(
                  new Set([
                    'Engineering',
                    'Architecture',
                    'Learning',
                    'Operations',
                    ...categories.map((c) => c.name),
                  ])
                ).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskItem['priority'])}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskItem['status'])}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Recurrence
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as TaskItem['recurrence'])}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              >
                <option value="None">One-time</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Est. Minutes
              </label>
              <input
                type="number"
                min={1}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Actual Minutes
              </label>
              <input
                type="number"
                min={0}
                value={actualMinutes}
                onChange={(e) => setActualMinutes(e.target.value)}
                placeholder="Optional"
                className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
              />
            </div>
          </div>

          {(projects.length > 0 || availableTasks.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Link Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                >
                  <option value="">No linked project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Depends On Task
                </label>
                <select
                  value={dependsOnTaskId}
                  onChange={(e) => setDependsOnTaskId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                >
                  <option value="">No dependency</option>
                  {availableTasks
                    .filter((t) => t.id !== editingTask?.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={isDailyCommitment}
              onChange={(e) => setIsDailyCommitment(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <div className="text-sm font-medium">Mark as Daily Streak Commitment</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Only daily commitments count toward maintaining your daily consistency streak.
                Optional tasks remain tracked separately.
              </div>
            </div>
          </label>

          {!editingTask && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Subtasks
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtaskDraft();
                    }
                  }}
                  placeholder="Add a subtask step..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddSubtaskDraft}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
              {subtaskDrafts.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {subtaskDrafts.map((st, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-950 text-xs"
                    >
                      <span>{st}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSubtaskDrafts((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional implementation links or notes..."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
