import crypto from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  githubAccounts,
  githubActivity,
  githubContributions,
  githubRepositories,
} from '../db/schema.ts';

function getStateSecret() {
  return (
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.GEMINI_API_KEY ||
    'progress-tracker-oauth-state-fallback'
  );
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function getGitHubRedirectUri(originFallback?: string): string {
  const base = (process.env.APP_URL || originFallback || 'http://localhost:3000').replace(
    /\/+$/,
    ''
  );
  return `${base}/auth/github/callback`;
}

export function createSignedOAuthState(userId: string): string {
  const payload = JSON.stringify({
    userId,
    ts: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex'),
  });
  const encoded = Buffer.from(payload).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getStateSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedOAuthState(state: string): { userId: string } | null {
  try {
    const [encoded, sig] = state.split('.');
    if (!encoded || !sig) return null;
    const expected = crypto
      .createHmac('sha256', getStateSecret())
      .update(encoded)
      .digest('base64url');
    if (sig !== expected) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed.userId || Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

export function buildGitHubAuthUrl(userId: string, originFallback?: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('GitHub OAuth is not configured on the server.');
  }
  const redirectUri = getGitHubRedirectUri(originFallback);
  const state = createSignedOAuthState(userId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user repo',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeGitHubCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; scope: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET.');
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed (${response.status})`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || 'GitHub OAuth failed.');
  }

  return {
    accessToken: data.access_token,
    scope: data.scope || 'read:user repo',
  };
}

function mapContributionLevel(levelStr: string): number {
  switch (levelStr) {
    case 'FIRST_QUARTILE':
      return 1;
    case 'SECOND_QUARTILE':
      return 2;
    case 'THIRD_QUARTILE':
      return 3;
    case 'FOURTH_QUARTILE':
      return 4;
    default:
      return 0;
  }
}

export async function connectAndSyncGitHub(
  userId: string,
  accessToken: string,
  scope: string
) {
  const userResp = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ProgressTrackerApp',
    },
  });

  if (!userResp.ok) {
    throw new Error(`Failed to fetch GitHub profile (${userResp.status})`);
  }

  const profile = (await userResp.json()) as {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
    public_repos: number;
    followers: number;
  };

  await db
    .insert(githubAccounts)
    .values({
      userId,
      githubId: String(profile.id),
      username: profile.login,
      avatarUrl: profile.avatar_url,
      profileUrl: profile.html_url,
      accessToken,
      scope,
      publicReposCount: profile.public_repos || 0,
      followersCount: profile.followers || 0,
      syncError: null,
    })
    .onConflictDoUpdate({
      target: githubAccounts.userId,
      set: {
        githubId: String(profile.id),
        username: profile.login,
        avatarUrl: profile.avatar_url,
        profileUrl: profile.html_url,
        accessToken,
        scope,
        publicReposCount: profile.public_repos || 0,
        followersCount: profile.followers || 0,
        syncError: null,
      },
    });

  return syncGitHubDataForUser(userId);
}

export async function syncGitHubDataForUser(userId: string) {
  const [account] = await db
    .select()
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId));

  if (!account) {
    throw new Error('No GitHub account connected.');
  }

  const headers = {
    Authorization: `Bearer ${account.accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ProgressTrackerApp',
  };

  try {
    // 1. Refresh user profile counts via REST
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (userRes.status === 403 || userRes.status === 429) {
      const reset = userRes.headers.get('X-RateLimit-Reset');
      throw new Error(
        `GitHub API rate limit reached${reset ? ` (resets at ${new Date(Number(reset) * 1000).toLocaleTimeString()})` : ''}.`
      );
    }
    if (!userRes.ok) {
      throw new Error(`GitHub REST profile sync failed (${userRes.status}).`);
    }
    const profile = (await userRes.json()) as {
      public_repos: number;
      followers: number;
      avatar_url: string;
      login: string;
    };

    // 2. Fetch contribution calendar via GitHub GraphQL API
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const gqlQuery = `
      query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
            totalPullRequestContributions
            totalIssueContributions
            totalRepositoryContributions
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                  contributionLevel
                }
              }
            }
          }
        }
      }
    `;

    const gqlRes = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: gqlQuery,
        variables: {
          login: account.username,
          from: oneYearAgo.toISOString(),
          to: now.toISOString(),
        },
      }),
    });

    if (gqlRes.ok) {
      const gqlJson = (await gqlRes.json()) as {
        data?: {
          user?: {
            contributionsCollection?: {
              contributionCalendar?: {
                weeks?: Array<{
                  contributionDays: Array<{
                    date: string;
                    contributionCount: number;
                    contributionLevel: string;
                  }>;
                }>;
              };
            };
          };
        };
        errors?: Array<{ message: string }>;
      };

      const weeks =
        gqlJson.data?.user?.contributionsCollection?.contributionCalendar?.weeks || [];
      for (const week of weeks) {
        for (const day of week.contributionDays) {
          await db
            .insert(githubContributions)
            .values({
              userId,
              date: day.date,
              count: day.contributionCount,
              level: mapContributionLevel(day.contributionLevel),
            })
            .onConflictDoUpdate({
              target: [githubContributions.userId, githubContributions.date],
              set: {
                count: day.contributionCount,
                level: mapContributionLevel(day.contributionLevel),
              },
            });
        }
      }
    }

    // 3. Fetch Repositories via REST API
    const reposRes = await fetch(
      'https://api.github.com/user/repos?sort=pushed&direction=desc&per_page=30&type=owner',
      { headers }
    );
    if (reposRes.ok) {
      const repos = (await reposRes.json()) as Array<{
        id: number;
        name: string;
        full_name: string;
        description: string | null;
        language: string | null;
        stargazers_count: number;
        forks_count: number;
        open_issues_count: number;
        html_url: string;
        pushed_at: string;
        private: boolean;
      }>;

      for (const r of repos) {
        await db
          .insert(githubRepositories)
          .values({
            userId,
            repoId: String(r.id),
            name: r.name,
            fullName: r.full_name,
            description: r.description || '',
            language: r.language || 'Unknown',
            stars: r.stargazers_count || 0,
            forks: r.forks_count || 0,
            openIssues: r.open_issues_count || 0,
            htmlUrl: r.html_url,
            pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
            isPrivate: Boolean(r.private),
          })
          .onConflictDoUpdate({
            target: [githubRepositories.userId, githubRepositories.repoId],
            set: {
              name: r.name,
              fullName: r.full_name,
              description: r.description || '',
              language: r.language || 'Unknown',
              stars: r.stargazers_count || 0,
              forks: r.forks_count || 0,
              openIssues: r.open_issues_count || 0,
              htmlUrl: r.html_url,
              pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
              isPrivate: Boolean(r.private),
            },
          });
      }
    }

    // 4. Fetch Recent Events (Commits, PRs, Issues) via REST API
    const eventsRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(account.username)}/events?per_page=40`,
      { headers }
    );
    if (eventsRes.ok) {
      const events = (await eventsRes.json()) as Array<{
        id: string;
        type: string;
        repo: { name: string };
        created_at: string;
        payload: {
          commits?: Array<{ sha: string; message: string }>;
          pull_request?: { title: string; html_url: string; state: string; merged?: boolean };
          issue?: { title: string; html_url: string; state: string };
          action?: string;
        };
      }>;

      for (const ev of events) {
        if (ev.type === 'PushEvent' && ev.payload.commits?.length) {
          const latest = ev.payload.commits[ev.payload.commits.length - 1];
          const msg = latest.message.split('\n')[0];
          await db
            .insert(githubActivity)
            .values({
              userId,
              eventId: `push-${ev.id}`,
              eventType: 'commit',
              repoName: ev.repo.name,
              title: msg,
              state: 'committed',
              url: `https://github.com/${ev.repo.name}/commit/${latest.sha}`,
              occurredAt: new Date(ev.created_at),
            })
            .onConflictDoNothing({
              target: [githubActivity.userId, githubActivity.eventId],
            });
        } else if (ev.type === 'PullRequestEvent' && ev.payload.pull_request) {
          const pr = ev.payload.pull_request;
          await db
            .insert(githubActivity)
            .values({
              userId,
              eventId: `pr-${ev.id}`,
              eventType: 'pr',
              repoName: ev.repo.name,
              title: pr.title,
              state: pr.merged ? 'merged' : pr.state,
              url: pr.html_url,
              occurredAt: new Date(ev.created_at),
            })
            .onConflictDoNothing({
              target: [githubActivity.userId, githubActivity.eventId],
            });
        } else if (ev.type === 'IssuesEvent' && ev.payload.issue) {
          const issue = ev.payload.issue;
          await db
            .insert(githubActivity)
            .values({
              userId,
              eventId: `issue-${ev.id}`,
              eventType: 'issue',
              repoName: ev.repo.name,
              title: issue.title,
              state: issue.state,
              url: issue.html_url,
              occurredAt: new Date(ev.created_at),
            })
            .onConflictDoNothing({
              target: [githubActivity.userId, githubActivity.eventId],
            });
        }
      }
    }

    await db
      .update(githubAccounts)
      .set({
        username: profile.login,
        avatarUrl: profile.avatar_url,
        publicReposCount: profile.public_repos || 0,
        followersCount: profile.followers || 0,
        lastSyncedAt: new Date(),
        syncError: null,
      })
      .where(eq(githubAccounts.userId, userId));

    return getGitHubOverview(userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GitHub sync failed.';
    await db
      .update(githubAccounts)
      .set({ syncError: message })
      .where(eq(githubAccounts.userId, userId));
    throw err;
  }
}

export async function getGitHubOverview(userId: string) {
  try {
    const [account] = await db
      .select({
        id: githubAccounts.id,
        username: githubAccounts.username,
        avatarUrl: githubAccounts.avatarUrl,
        profileUrl: githubAccounts.profileUrl,
        publicReposCount: githubAccounts.publicReposCount,
        followersCount: githubAccounts.followersCount,
        lastSyncedAt: githubAccounts.lastSyncedAt,
        syncError: githubAccounts.syncError,
      })
      .from(githubAccounts)
      .where(eq(githubAccounts.userId, userId));

    const contributions = await db
      .select()
      .from(githubContributions)
      .where(eq(githubContributions.userId, userId))
      .orderBy(githubContributions.date);

    const repositories = await db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.userId, userId))
      .orderBy(desc(githubRepositories.pushedAt));

    const activity = await db
      .select()
      .from(githubActivity)
      .where(eq(githubActivity.userId, userId))
      .orderBy(desc(githubActivity.occurredAt));

    const todayStr = new Date().toISOString().slice(0, 10);
    const currentYear = todayStr.slice(0, 4);
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const monthPrefix = todayStr.slice(0, 7);

    let totalAllTime = 0;
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let yearCount = 0;

    let longestStreak = 0;
    let running = 0;
    const positiveDates = new Set<string>();

    for (const c of contributions) {
      totalAllTime += c.count;
      if (c.date === todayStr) todayCount += c.count;
      if (c.date >= weekAgo && c.date <= todayStr) weekCount += c.count;
      if (c.date.startsWith(monthPrefix)) monthCount += c.count;
      if (c.date.startsWith(currentYear)) yearCount += c.count;

      if (c.count > 0) {
        positiveDates.add(c.date);
        running += 1;
        if (running > longestStreak) longestStreak = running;
      } else {
        running = 0;
      }
    }

    // Current GitHub contribution streak
    let currentStreak = 0;
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    let cursor = positiveDates.has(todayStr)
      ? todayStr
      : positiveDates.has(yesterdayStr)
        ? yesterdayStr
        : null;

    while (cursor && positiveDates.has(cursor)) {
      currentStreak += 1;
      const dt = new Date(`${cursor}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() - 1);
      cursor = dt.toISOString().slice(0, 10);
    }

    // Advanced Analytics computed strictly from real synced GitHub rows
    const langCounts = new Map<string, number>();
    for (const r of repositories) {
      const lang = r.language && r.language !== 'Unknown' ? r.language : 'Other';
      langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
    }
    const repoTotal = repositories.length || 1;
    const languageBreakdown = Array.from(langCounts.entries())
      .map(([language, count]) => ({
        language,
        count,
        pct: Math.round((count / repoTotal) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const activityByRepo = new Map<string, number>();
    for (const ev of activity) {
      activityByRepo.set(ev.repoName, (activityByRepo.get(ev.repoName) || 0) + 1);
    }

    const mostActiveRepos = [...repositories]
      .map((r) => {
        const recentEvents = activityByRepo.get(r.fullName) || 0;
        const pushedDaysAgo = r.pushedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(r.pushedAt).getTime()) / 86400000))
          : 365;
        const recencyBonus = Math.max(0, 30 - pushedDaysAgo);
        const activityScore = recentEvents * 10 + r.stars * 2 + r.forks * 2 + r.openIssues + recencyBonus;
        return {
          id: r.id,
          name: r.name,
          fullName: r.fullName,
          language: r.language || 'Unknown',
          stars: r.stars,
          forks: r.forks,
          openIssues: r.openIssues,
          recentEvents,
          activityScore,
          htmlUrl: r.htmlUrl,
          pushedAt: r.pushedAt,
        };
      })
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 10);

    // Weekly contribution trends (last 12 weeks)
    const weeklyBuckets = new Map<string, number>();
    const monthlyBuckets = new Map<string, number>();
    for (const c of contributions) {
      const dt = new Date(`${c.date}T00:00:00Z`);
      const day = dt.getUTCDay();
      const diffToMon = (day + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - diffToMon);
      const weekKey = dt.toISOString().slice(0, 10);
      weeklyBuckets.set(weekKey, (weeklyBuckets.get(weekKey) || 0) + c.count);

      const monthKey = c.date.slice(0, 7);
      monthlyBuckets.set(monthKey, (monthlyBuckets.get(monthKey) || 0) + c.count);
    }

    const weeklyTrends = Array.from(weeklyBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([weekStart, count]) => ({ weekStart: weekStart.slice(5), fullWeekStart: weekStart, count }));

    const monthlyTrends = Array.from(monthlyBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    return {
      oauthConfigured: isGitHubOAuthConfigured(),
      connected: Boolean(account),
      account: account || null,
      stats: {
        totalContributions: totalAllTime,
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        thisYear: yearCount,
        currentStreak,
        longestStreak,
        publicRepos: account?.publicReposCount || repositories.filter((r) => !r.isPrivate).length,
      },
      contributions,
      repositories,
      activity,
      analytics: {
        languageBreakdown,
        mostActiveRepos,
        weeklyTrends,
        monthlyTrends,
      },
    };
  } catch (error) {
    console.error('Database query failed in getGitHubOverview:', error);
    throw new Error('Failed to load GitHub telemetry.', { cause: error });
  }
}
