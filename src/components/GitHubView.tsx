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
import {
  AlertCircle,
  Code2,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  RefreshCw,
  Star,
  Unlink,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { GitHubOverviewData } from '../types';

interface GitHubViewProps {
  refreshTrigger: number;
  onSyncCompleted: () => void;
}

type RangeFilter = '7d' | '30d' | '90d' | 'year' | 'all';

export const GitHubView: React.FC<GitHubViewProps> = ({
  refreshTrigger,
  onSyncCompleted,
}) => {
  const [data, setData] = useState<GitHubOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeFilter>('year');
  const [trendMode, setTrendMode] = useState<'weekly' | 'monthly'>('weekly');
  const [activityFilter, setActivityFilter] = useState<'all' | 'commit' | 'pr' | 'issue'>('all');

  const loadGitHub = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<GitHubOverviewData>('/api/github');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load GitHub data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGitHub();
  }, [refreshTrigger]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        loadGitHub();
        onSyncCompleted();
      } else if (event.data?.type === 'GITHUB_OAUTH_ERROR') {
        setError(event.data.error || 'GitHub OAuth failed.');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSyncCompleted]);

  const handleConnectGitHub = async () => {
    setError(null);
    try {
      const res = await apiFetch<{ url: string }>('/api/github/auth-url');
      const popup = window.open(res.url, 'github_oauth_popup', 'width=620,height=720');
      if (!popup) {
        setError('Popup blocked. Please allow popups for this site to connect GitHub.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to start GitHub OAuth.');
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await apiFetch<GitHubOverviewData>('/api/github/sync', {
        method: 'POST',
      });
      setData(res);
      onSyncCompleted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    await apiFetch('/api/github/disconnect', { method: 'DELETE' });
    await loadGitHub();
    onSyncCompleted();
  };

  const filteredContributions = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    let cutoff = '1970-01-01';
    if (range === '7d') {
      cutoff = new Date(today.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    } else if (range === '30d') {
      cutoff = new Date(today.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    } else if (range === '90d') {
      cutoff = new Date(today.getTime() - 89 * 86400000).toISOString().slice(0, 10);
    } else if (range === 'year') {
      cutoff = `${today.getFullYear()}-01-01`;
    }
    return data.contributions.filter((c) => c.date >= cutoff);
  }, [data, range]);

  const rangeTotal = useMemo(
    () => filteredContributions.reduce((acc, c) => acc + c.count, 0),
    [filteredContributions]
  );

  // Group contributions into 7-day columns for heatmap
  const contributionColumns = useMemo(() => {
    const cols: Array<typeof filteredContributions> = [];
    for (let i = 0; i < filteredContributions.length; i += 7) {
      cols.push(filteredContributions.slice(i, i + 7));
    }
    return cols;
  }, [filteredContributions]);

  if (loading && !data) {
    return <div className="p-8 text-xs text-slate-500">Loading GitHub telemetry...</div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GitHub Activity Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time contribution graph via GraphQL and repository telemetry via GitHub REST API.
          </p>
        </div>

        {data.connected && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Refresh Sync'}</span>
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!data.connected ? (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Connect Your GitHub Account</h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
                Authorize read-only access to synchronize your GraphQL contribution calendar,
                active repositories, commits, pull requests, and issue activity. Credentials remain
                encrypted on the server.
              </p>
            </div>
            <button
              onClick={handleConnectGitHub}
              disabled={!data.oauthConfigured}
              className="px-5 py-2.5 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <GitBranch className="w-4 h-4" />
              <span>Connect with GitHub OAuth</span>
            </button>
          </div>

          {!data.oauthConfigured && (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Server OAuth Configuration Required
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                To enable real GitHub synchronization, create a GitHub OAuth App at{' '}
                <a
                  href="https://github.com/settings/developers"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 underline"
                >
                  github.com/settings/developers
                </a>{' '}
                and set <code className="font-mono">GITHUB_CLIENT_ID</code> and{' '}
                <code className="font-mono">GITHUB_CLIENT_SECRET</code> in your AI Studio Secrets.
              </p>
              <div className="pt-1">
                <span className="text-slate-500">Authorization callback URL: </span>
                <code className="font-mono text-slate-900 dark:text-slate-100 select-all">
                  {data.callbackUrl}
                </code>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Connected Profile & Stats */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {data.account?.avatarUrl && (
                <img
                  src={data.account.avatarUrl}
                  alt={data.account.username}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">@{data.account?.username}</span>
                  {data.account?.profileUrl && (
                    <a
                      href={data.account.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-emerald-500"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {data.stats.publicRepos} public repos · Last synced{' '}
                  {data.account?.lastSyncedAt
                    ? new Date(data.account.lastSyncedAt).toLocaleString()
                    : 'Never'}
                </div>
                {data.account?.syncError && (
                  <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Last sync warning: {data.account.syncError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              ['Today', data.stats.today],
              ['This Week', data.stats.thisWeek],
              ['This Month', data.stats.thisMonth],
              ['This Year', data.stats.thisYear],
              ['Total Synced', data.stats.totalContributions],
              ['Current Streak', `${data.stats.currentStreak}d`],
              ['Longest Streak', `${data.stats.longestStreak}d`],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                <div className="mt-1.5 text-xl font-semibold font-mono tabular-nums">{val}</div>
              </div>
            ))}
          </div>

          {/* Contribution Heatmap with Time Filter */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold">
                  Contribution Heatmap ({rangeTotal} contributions in range)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Independent from daily task commitments
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                {(
                  [
                    ['7d', '7 Days'],
                    ['30d', '30 Days'],
                    ['90d', '90 Days'],
                    ['year', 'This Year'],
                    ['all', 'All Time'],
                  ] as Array<[RangeFilter, string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setRange(id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      range === id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredContributions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No contribution days recorded in this range.
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div className="inline-flex gap-1">
                  {contributionColumns.map((col, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      {col.map((day) => {
                        const colors = [
                          'bg-slate-100 dark:bg-slate-800/80',
                          'bg-emerald-200 dark:bg-emerald-950',
                          'bg-emerald-400 dark:bg-emerald-800',
                          'bg-emerald-500 dark:bg-emerald-600',
                          'bg-emerald-700 dark:bg-emerald-400',
                        ];
                        return (
                          <div
                            key={day.date}
                            title={`${day.date}: ${day.count} contributions`}
                            className={`w-3 h-3 rounded-[2px] ${colors[day.level] || colors[0]}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Advanced GitHub Analytics: Trends + Languages + Repo Comparison */}
          {data.analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Contribution Trends</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Aggregated directly from synced GraphQL calendar days
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setTrendMode('weekly')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        trendMode === 'weekly'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Weekly (12w)
                    </button>
                    <button
                      onClick={() => setTrendMode('monthly')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        trendMode === 'monthly'
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Monthly (12m)
                    </button>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        trendMode === 'weekly'
                          ? data.analytics.weeklyTrends.map((w) => ({ label: w.weekStart, count: w.count }))
                          : data.analytics.monthlyTrends.map((m) => ({ label: m.month, count: m.count }))
                      }
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
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
                      <Bar dataKey="count" name="Contributions" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Programming Languages Breakdown */}
              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Languages Across Repos</h2>
                  <Code2 className="w-4 h-4 text-emerald-500" />
                </div>
                {data.analytics.languageBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-500">No repository language data synced yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.analytics.languageBreakdown.slice(0, 7).map((lang) => (
                      <div key={lang.language} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{lang.language}</span>
                          <span className="font-mono tabular-nums text-slate-500">
                            {lang.count} repos ({lang.pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${lang.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Repository Activity Comparison */}
          {data.analytics && data.analytics.mostActiveRepos.length > 0 && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Repository Activity Comparison</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comparing stars, forks, open issues, and recent events across your top repositories
                </p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.analytics.mostActiveRepos.slice(0, 6)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" />
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
                    <Bar dataKey="stars" name="Stars" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="forks" name="Forks" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="recentEvents" name="Recent Events" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Repositories & Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold mb-3">Most Active Repositories</h2>
              {data.repositories.length === 0 ? (
                <p className="text-xs text-slate-500">No repositories synced yet.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(data.analytics?.mostActiveRepos || data.repositories).slice(0, 8).map((repo) => (
                    <div key={repo.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium hover:text-emerald-500 inline-flex items-center gap-1"
                        >
                          <span className="truncate">{repo.name}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>{repo.language}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Star className="w-3 h-3" /> {repo.stars}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{repo.forks} forks</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{repo.openIssues} issues</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold">Recent Commits, PRs & Issues</h2>
                <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {(
                    [
                      ['all', 'All'],
                      ['commit', 'Commits'],
                      ['pr', 'PRs'],
                      ['issue', 'Issues'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setActivityFilter(id)}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                        activityFilter === id
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {data.activity.filter((ev) =>
                activityFilter === 'all' ? true : ev.eventType === activityFilter
              ).length === 0 ? (
                <p className="text-xs text-slate-500">No matching GitHub events synced.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data.activity
                    .filter((ev) =>
                      activityFilter === 'all' ? true : ev.eventType === activityFilter
                    )
                    .slice(0, 10)
                    .map((ev) => (
                      <div key={ev.id} className="py-2.5 flex items-start gap-3">
                        <div className="mt-0.5 text-slate-400 shrink-0">
                          {ev.eventType === 'pr' ? (
                            <GitPullRequest className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <GitCommitHorizontal className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium hover:text-emerald-500 block truncate"
                          >
                            {ev.title}
                          </a>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {ev.repoName} · {ev.eventType.toUpperCase()} · {ev.state} ·{' '}
                            {new Date(ev.occurredAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
