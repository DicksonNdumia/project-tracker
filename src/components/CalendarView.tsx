import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame, Plus } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { TaskCategory, TaskItem } from '../types';
import { QuickTaskModal } from './QuickTaskModal';

interface CalendarViewProps {
  refreshTrigger: number;
  onTasksChanged: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  refreshTrigger,
  onTasksChanged,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(now.toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ tasks: TaskItem[]; categories: TaskCategory[] }>(
        '/api/tasks'
      );
      setTasks(res.tasks);
      setCategories(res.categories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [refreshTrigger]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      const key = t.dueDate || t.startDate;
      if (!key) continue;
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const calendarDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ dateKey: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ dateKey: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ dateKey: `${year}-${mm}-${dd}`, dayNum: d });
    }
    return cells;
  }, [monthCursor]);

  const selectedDayTasks = tasksByDate.get(selectedDate) || [];
  const todayKey = new Date().toISOString().slice(0, 10);

  const handleToggleComplete = async (task: TaskItem) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    await apiFetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadTasks();
    onTasksChanged();
  };

  const handleSaveTask = async (payload: Record<string, unknown>) => {
    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadTasks();
    onTasksChanged();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Inspect scheduled tasks, due dates, and daily commitments by day.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule on {selectedDate}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Grid */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">
              {monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setMonthCursor(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  )
                }
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const t = new Date();
                  setMonthCursor(new Date(t.getFullYear(), t.getMonth(), 1));
                  setSelectedDate(todayKey);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() =>
                  setMonthCursor(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  )
                }
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((cell, idx) => {
              if (!cell.dateKey) {
                return <div key={idx} className="h-20 rounded-lg bg-slate-50/40 dark:bg-slate-950/30" />;
              }
              const dayTasks = tasksByDate.get(cell.dateKey) || [];
              const isSelected = cell.dateKey === selectedDate;
              const isToday = cell.dateKey === todayKey;
              const pendingCount = dayTasks.filter((t) => t.status !== 'Completed').length;
              const doneCount = dayTasks.filter((t) => t.status === 'Completed').length;

              return (
                <button
                  key={cell.dateKey}
                  onClick={() => setSelectedDate(cell.dateKey!)}
                  className={`h-20 p-2 rounded-lg border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : 'border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-mono tabular-nums ${
                        isToday
                          ? 'px-1.5 py-0.5 rounded bg-emerald-600 text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        {doneCount}/{dayTasks.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className={`text-[11px] truncate ${
                          t.status === 'Completed'
                            ? 'text-slate-400 line-through'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {pendingCount > 2 && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        +{dayTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Selected Date</div>
              <div className="text-base font-semibold font-mono tabular-nums">{selectedDate}</div>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {selectedDayTasks.length} tasks
            </span>
          </div>

          <div className="flex-1 mt-4 space-y-3 overflow-y-auto">
            {loading ? (
              <div className="text-xs text-slate-500">Loading schedule...</div>
            ) : selectedDayTasks.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No tasks scheduled for {selectedDate}.
                </p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Add Task for Date
                </button>
              </div>
            ) : (
              selectedDayTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-3"
                >
                  <button
                    onClick={() => handleToggleComplete(t)}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                      t.status === 'Completed'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {t.status === 'Completed' && <Check className="w-3 h-3" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-medium ${
                        t.status === 'Completed' ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{t.categoryName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.priority}</span>
                      {t.isDailyCommitment && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Flame className="w-3 h-3" /> Commitment
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <QuickTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTask}
        defaultDate={selectedDate}
        categories={categories}
      />
    </div>
  );
};
