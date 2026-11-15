import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  Flame,
  FolderKanban,
  Link2,
  Plus,
  Repeat,
  Search,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { ProjectItem, TaskCategory, TaskItem } from '../types';
import { QuickTaskModal } from './QuickTaskModal';

interface TasksViewProps {
  globalSearch: string;
  onTasksChanged: () => void;
  refreshTrigger: number;
}

type GroupTab = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

const PRIORITY_WEIGHT: Record<TaskItem['priority'], number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export const TasksView: React.FC<TasksViewProps> = ({
  globalSearch,
  onTasksChanged,
  refreshTrigger,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupTab, setGroupTab] = useState<GroupTab>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [deadlineFilter, setDeadlineFilter] = useState<'All' | 'Overdue' | 'Today' | 'ThisWeek' | 'NoDeadline'>('All');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority'>('dueDate');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [newSubtaskInput, setNewSubtaskInput] = useState<Record<string, string>>({});

  // Quick capture bar
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<TaskItem['priority']>('Medium');
  const [quickSaving, setQuickSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        apiFetch<{ tasks: TaskItem[]; categories: TaskCategory[] }>('/api/tasks'),
        apiFetch<{ projects: ProjectItem[] }>('/api/projects'),
      ]);
      setTasks(tasksRes.tasks);
      setCategories(tasksRes.categories);
      setProjects(projectsRes.projects);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [refreshTrigger]);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setQuickSaving(true);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: quickTitle.trim(),
          priority: quickPriority,
          dueDate: today,
          startDate: today,
        }),
      });
      setQuickTitle('');
      await loadTasks();
      onTasksChanged();
    } finally {
      setQuickSaving(false);
    }
  };

  const handleSaveTask = async (payload: Record<string, unknown>, taskId?: string) => {
    if (taskId) {
      await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    await loadTasks();
    onTasksChanged();
  };

  const handleToggleComplete = async (task: TaskItem) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    await apiFetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadTasks();
    onTasksChanged();
  };

  const handleDeleteTask = async (id: string) => {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await loadTasks();
    onTasksChanged();
  };

  const handleToggleSubtask = async (subId: string, current: boolean) => {
    await apiFetch(`/api/tasks/subtasks/${subId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted: !current }),
    });
    await loadTasks();
  };

  const handleAddSubtask = async (taskId: string) => {
    const text = (newSubtaskInput[taskId] || '').trim();
    if (!text) return;
    await apiFetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title: text }),
    });
    setNewSubtaskInput((prev) => ({ ...prev, [taskId]: '' }));
    await loadTasks();
  };

  const handleDeleteSubtask = async (subId: string) => {
    await apiFetch(`/api/tasks/subtasks/${subId}`, { method: 'DELETE' });
    await loadTasks();
  };

  const query = (search || globalSearch).trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (groupTab === 'today') {
          if (t.status === 'Completed' || t.status === 'Cancelled') return false;
          return t.dueDate === today || (!t.dueDate && t.isDailyCommitment);
        }
        if (groupTab === 'upcoming') {
          if (t.status === 'Completed' || t.status === 'Cancelled') return false;
          return Boolean(t.dueDate && t.dueDate > today);
        }
        if (groupTab === 'overdue') {
          if (t.status === 'Completed' || t.status === 'Cancelled') return false;
          return Boolean(t.dueDate && t.dueDate < today);
        }
        if (groupTab === 'completed') {
          return t.status === 'Completed';
        }
        return true;
      })
      .filter((t) => (statusFilter === 'All' ? true : t.status === statusFilter))
      .filter((t) => (priorityFilter === 'All' ? true : t.priority === priorityFilter))
      .filter((t) => (categoryFilter === 'All' ? true : t.categoryName === categoryFilter))
      .filter((t) => {
        if (deadlineFilter === 'All') return true;
        if (deadlineFilter === 'Overdue') {
          return (
            t.status !== 'Completed' &&
            t.status !== 'Cancelled' &&
            Boolean(t.dueDate && t.dueDate < today)
          );
        }
        if (deadlineFilter === 'Today') return t.dueDate === today;
        if (deadlineFilter === 'ThisWeek') {
          return Boolean(t.dueDate && t.dueDate >= today && t.dueDate <= weekAhead);
        }
        if (deadlineFilter === 'NoDeadline') return !t.dueDate;
        return true;
      })
      .filter((t) => {
        if (!query) return true;
        return (
          t.title.toLowerCase().includes(query) ||
          (t.description || '').toLowerCase().includes(query) ||
          t.categoryName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
      });
  }, [
    tasks,
    groupTab,
    statusFilter,
    priorityFilter,
    categoryFilter,
    deadlineFilter,
    query,
    sortBy,
    today,
    weekAhead,
  ]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const estimationComparison = useMemo(() => {
    const compared = tasks.filter(
      (t) =>
        t.status === 'Completed' &&
        t.estimatedMinutes != null &&
        t.actualMinutes != null &&
        t.estimatedMinutes > 0
    );
    const totalEst = compared.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
    const totalAct = compared.reduce((acc, t) => acc + (t.actualMinutes || 0), 0);
    return {
      count: compared.length,
      totalEst,
      totalAct,
      variancePct:
        totalEst > 0 ? Math.round(((totalAct - totalEst) / totalEst) * 100) : 0,
      items: compared.slice(0, 4),
    };
  }, [tasks]);

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      today: tasks.filter(
        (t) =>
          t.status !== 'Completed' &&
          t.status !== 'Cancelled' &&
          (t.dueDate === today || (!t.dueDate && t.isDailyCommitment))
      ).length,
      upcoming: tasks.filter(
        (t) =>
          t.status !== 'Completed' &&
          t.status !== 'Cancelled' &&
          Boolean(t.dueDate && t.dueDate > today)
      ).length,
      overdue: tasks.filter(
        (t) =>
          t.status !== 'Completed' &&
          t.status !== 'Cancelled' &&
          Boolean(t.dueDate && t.dueDate < today)
      ).length,
      completed: tasks.filter((t) => t.status === 'Completed').length,
    };
  }, [tasks, today]);

  const categoryOptions = Array.from(
    new Set([
      'All',
      'Engineering',
      'Architecture',
      'Learning',
      'Operations',
      ...categories.map((c) => c.name),
      ...tasks.map((t) => t.categoryName),
    ])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage daily commitments, recurring tasks, priorities, and subtasks.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null);
            setModalOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Inline Quick Task Capture */}
      <form
        onSubmit={handleQuickCapture}
        className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Quick capture a task for today (press Enter)..."
          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex items-center gap-2">
          <select
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as TaskItem['priority'])}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
          <button
            type="submit"
            disabled={quickSaving || !quickTitle.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {quickSaving ? 'Adding...' : 'Quick Add'}
          </button>
        </div>
      </form>

      {/* Group Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          {(
            [
              ['all', `All (${counts.all})`],
              ['today', `Today (${counts.today})`],
              ['upcoming', `Upcoming (${counts.upcoming})`],
              ['overdue', `Overdue (${counts.overdue})`],
              ['completed', `Completed (${counts.completed})`],
            ] as Array<[GroupTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setGroupTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                groupTab === id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tasks..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs w-44"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
          >
            <option value="All">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Categories' : c}
              </option>
            ))}
          </select>
          <select
            value={deadlineFilter}
            onChange={(e) => setDeadlineFilter(e.target.value as typeof deadlineFilter)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
          >
            <option value="All">All Deadlines</option>
            <option value="Overdue">Overdue</option>
            <option value="Today">Due Today</option>
            <option value="ThisWeek">Next 7 Days</option>
            <option value="NoDeadline">No Deadline</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
          >
            <option value="dueDate">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Task List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-sm font-medium">No matching tasks</div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Create a new task or adjust your active filters.
            </p>
            <button
              onClick={() => {
                setEditingTask(null);
                setModalOpen(true);
              }}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
            >
              Add First Task
            </button>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = Boolean(expandedTaskIds[task.id]);
            const subs = task.subtasks || [];
            const completedSubs = subs.filter((s) => s.isCompleted).length;
            const subPct = subs.length > 0 ? Math.round((completedSubs / subs.length) * 100) : 0;
            const isOverdue =
              task.status !== 'Completed' &&
              task.status !== 'Cancelled' &&
              Boolean(task.dueDate && task.dueDate < today);
            const isUpcomingSoon =
              task.status !== 'Completed' &&
              task.status !== 'Cancelled' &&
              Boolean(task.dueDate && task.dueDate >= today && task.dueDate <= weekAhead);
            const blocker = task.dependsOnTaskId ? taskById.get(task.dependsOnTaskId) : undefined;
            const isBlocked = Boolean(blocker && blocker.status !== 'Completed');
            const linkedProject = task.projectId ? projectById.get(task.projectId) : undefined;

            return (
              <div
                key={task.id}
                className={`p-4 transition-colors ${
                  isOverdue
                    ? 'bg-red-50/40 dark:bg-red-950/15 hover:bg-red-50/70 dark:hover:bg-red-950/25'
                    : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => handleToggleComplete(task)}
                      aria-label={
                        task.status === 'Completed' ? 'Mark task incomplete' : 'Mark task complete'
                      }
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        task.status === 'Completed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                      }`}
                    >
                      {task.status === 'Completed' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-medium ${
                            task.status === 'Completed'
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : ''
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.isDailyCommitment && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <Flame className="w-3 h-3" />
                            <span>Daily Commitment</span>
                          </span>
                        )}
                        {task.recurrence !== 'None' && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Repeat className="w-3 h-3" />
                            <span>{task.recurrence}</span>
                          </span>
                        )}
                        {isBlocked && blocker && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Link2 className="w-3 h-3" />
                            <span>Blocked by: {blocker.title}</span>
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Unboxed clean metadata with typographic separators */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{task.categoryName}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            task.priority === 'Urgent'
                              ? 'text-red-600 dark:text-red-400 font-medium'
                              : task.priority === 'High'
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : ''
                          }
                        >
                          {task.priority} Priority
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{task.status}</span>
                        {linkedProject && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <FolderKanban className="w-3 h-3" />
                              <span>{linkedProject.name}</span>
                            </span>
                          </>
                        )}
                        {task.dueDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-mono tabular-nums ${
                                isOverdue
                                  ? 'text-red-600 dark:text-red-400 font-medium'
                                  : isUpcomingSoon
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : ''
                              }`}
                            >
                              {isOverdue ? `Overdue (${task.dueDate})` : `Due ${task.dueDate}`}
                            </span>
                          </>
                        )}
                        {task.estimatedMinutes && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {task.estimatedMinutes}m est
                              {task.actualMinutes != null ? ` / ${task.actualMinutes}m act` : ''}
                            </span>
                          </>
                        )}
                      </div>

                      {subs.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-3 max-w-sm">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${subPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            {completedSubs}/{subs.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        setExpandedTaskIds((prev) => ({
                          ...prev,
                          [task.id]: !prev[task.id],
                        }))
                      }
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs inline-flex items-center gap-1 cursor-pointer"
                      title="Subtasks & Notes"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Subtasks</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      aria-label="Edit task"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      aria-label="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 ml-8 pl-4 border-l border-slate-200 dark:border-slate-800 space-y-2.5">
                    {task.notes && (
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Notes:{' '}
                        </span>
                        {task.notes}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {subs.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={s.isCompleted}
                              onChange={() => handleToggleSubtask(s.id, s.isCompleted)}
                              className="rounded border-slate-300 text-emerald-600"
                            />
                            <span
                              className={
                                s.isCompleted ? 'line-through text-slate-400' : ''
                              }
                            >
                              {s.title}
                            </span>
                          </label>
                          <button
                            onClick={() => handleDeleteSubtask(s.id)}
                            className="text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 max-w-md pt-1">
                      <input
                        type="text"
                        value={newSubtaskInput[task.id] || ''}
                        onChange={(e) =>
                          setNewSubtaskInput((prev) => ({
                            ...prev,
                            [task.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtask(task.id);
                          }
                        }}
                        placeholder="Add subtask..."
                        className="flex-1 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                      <button
                        onClick={() => handleAddSubtask(task.id)}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Estimation vs Actual Time Comparison */}
      {estimationComparison.count > 0 && (
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold">Estimation vs Actual Time</h2>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-500">
              {estimationComparison.totalEst}m est vs {estimationComparison.totalAct}m actual (
              {estimationComparison.variancePct > 0 ? '+' : ''}
              {estimationComparison.variancePct}% variance across {estimationComparison.count} tasks)
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {estimationComparison.items.map((item) => {
              const est = item.estimatedMinutes || 1;
              const act = item.actualMinutes || 0;
              const maxVal = Math.max(est, act, 1);
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                >
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="flex justify-between font-mono tabular-nums text-[11px] text-slate-500">
                    <span>Est: {est}m</span>
                    <span>Act: {act}m</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-slate-400"
                        style={{ width: `${Math.round((est / maxVal) * 100)}%` }}
                      />
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${act > est ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.round((act / maxVal) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <QuickTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTask}
        editingTask={editingTask}
        categories={categories}
        projects={projects}
        availableTasks={tasks}
      />
    </div>
  );
};
