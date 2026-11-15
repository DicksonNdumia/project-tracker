import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  ExternalLink,
  Flame,
  GitBranch,
  Layers,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SignInGate: React.FC = () => {
  const {
    signInWithGoogle,
    signInWithGoogleRedirect,
    resetServiceWorkersAndReload,
    signingIn,
    authError,
    authErrorCode,
    networkHint,
  } = useAuth();

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isNetworkError = authErrorCode === 'auth/network-request-failed';

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
              <div className="mb-4 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-2">
                <div className="flex items-start gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
                {networkHint && (
                  <p className="text-red-600/90 dark:text-red-300/90 leading-relaxed pl-6">
                    {networkHint}
                  </p>
                )}
                {isNetworkError && (
                  <div className="pl-6 pt-1 flex flex-wrap items-center gap-2">
                    {!isInIframe ? (
                      <button
                        type="button"
                        onClick={signInWithGoogleRedirect}
                        disabled={signingIn}
                        className="px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-500 font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span>Use Redirect Sign-In</span>
                      </button>
                    ) : (
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-red-600 text-white hover:bg-red-500 font-medium inline-flex items-center gap-1"
                      >
                        <span>Open in New Tab</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={resetServiceWorkersAndReload}
                      className="px-2.5 py-1 rounded border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Clear Cache &amp; Reload</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={signInWithGoogle}
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-medium text-sm hover:bg-slate-800 dark:hover:bg-emerald-400 transition-colors cursor-pointer disabled:opacity-60"
            >
              {signingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <span>Sign in with Google</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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
