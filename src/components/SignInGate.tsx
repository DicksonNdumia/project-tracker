import React from 'react';
import { ArrowRight, CheckSquare, Flame, GitBranch, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SignInGate: React.FC = () => {
  const { signInWithGoogle, authError } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch">
        <div className="p-8 sm:p-12 flex flex-col justify-between">
          <div>
            <div className="text-sm font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
              Progress Tracker
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
              Your personal command center for engineering output and growth.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Manage daily tasks and commitments, protect multi-day streaks, synchronize GitHub
              contributions, document software projects, and measure technical learning over time.
            </p>

            <div className="mt-8 space-y-4 border-t border-slate-200 dark:border-slate-800 pt-6">
              <div className="flex items-start gap-3">
                <CheckSquare className="w-4 h-4 mt-1 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Tasks, Subtasks & Recurring Schedules</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Prioritized execution grouped across Today, Upcoming, Overdue, and Calendar.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Flame className="w-4 h-4 mt-1 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Timezone-Aware Streak Discipline</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Streaks track dedicated daily commitments separately from optional backlog items.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <GitBranch className="w-4 h-4 mt-1 text-slate-700 dark:text-slate-300 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Live GitHub GraphQL & REST Sync</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Real contribution heatmaps, repositories, commits, pull requests, and issues.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Layers className="w-4 h-4 mt-1 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Project Portfolio & Learning Logs</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Selective public portfolio showcase, skill proficiency goals, and daily journal.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {authError}
              </div>
            )}
            <button
              onClick={signInWithGoogle}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-medium text-sm hover:bg-slate-800 dark:hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <span>Sign in with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Private workspace backed by PostgreSQL with per-user access isolation.
            </p>
          </div>
        </div>

        <div className="relative min-h-[260px] lg:min-h-full bg-slate-900 overflow-hidden">
          <img
            src="/src/assets/images/project_cover_workspace_1794680296872.jpg"
            alt="Developer engineering workspace"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <div className="text-xs text-slate-300">Daily Execution · GitHub Sync · Portfolio</div>
            <div className="mt-1 text-base font-medium">
              Built for solo developers shipping consistently.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
