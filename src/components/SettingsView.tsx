import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Moon, Sun, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { exportWorkspacePdf } from '../lib/exportPdf';
import { auth } from '../lib/firebase';

export const SettingsView: React.FC = () => {
  const { profile, settings, theme, setTheme, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [portfolioSlug, setPortfolioSlug] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dailyCommitmentTarget, setDailyCommitmentTarget] = useState('1');

  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [streakReminders, setStreakReminders] = useState(true);
  const [milestoneAlerts, setMilestoneAlerts] = useState(true);
  const [emailReminders, setEmailReminders] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [githubAutoSync, setGithubAutoSync] = useState(true);
  const [publicPortfolioEnabled, setPublicPortfolioEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setBio(profile.bio || '');
      setPortfolioSlug(profile.portfolioSlug || '');
      setTimezone(profile.timezone || 'UTC');
      setDailyCommitmentTarget(String(profile.dailyCommitmentTarget || 1));
    }
    if (settings) {
      setDeadlineAlerts(settings.deadlineAlerts);
      setStreakReminders(settings.streakReminders);
      setMilestoneAlerts(settings.milestoneAlerts);
      setEmailReminders(settings.emailReminders);
      setReminderTime(settings.reminderTime || '09:00');
      setGithubAutoSync(settings.githubAutoSync);
      setPublicPortfolioEnabled(settings.publicPortfolioEnabled);
    }
  }, [profile, settings]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      await apiFetch('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName,
          bio,
          portfolioSlug,
          timezone,
          dailyCommitmentTarget: Number(dailyCommitmentTarget) || 1,
        }),
      });
      await apiFetch('/api/settings/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          deadlineAlerts,
          streakReminders,
          milestoneAlerts,
          emailReminders,
          reminderTime,
          githubAutoSync,
          publicPortfolioEnabled,
        }),
      });
      await refreshProfile();
      setStatusMsg('Settings saved.');
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadCsv = async (entity: 'tasks' | 'projects' | 'focus' | 'learning' | 'career') => {
    setDataMsg(null);
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const resp = await fetch(`/api/data/export-csv?entity=${entity}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      setDataMsg('Failed to export CSV.');
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress-tracker-${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDataMsg(`Exported ${entity} CSV.`);
  };

  const handleDownloadBackupJson = async () => {
    setDataMsg(null);
    const backup = await apiFetch<Record<string, unknown>>('/api/data/backup');
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progress-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDataMsg('Downloaded full JSON backup.');
  };

  const handleExportPdfSummary = async () => {
    setDataMsg(null);
    const backup = await apiFetch<{
      exportedAt: string;
      data: {
        tasks: Array<{ status: string }>;
        projects: unknown[];
        learningGoals: unknown[];
        focusSessions: unknown[];
        jobApplications: unknown[];
        certifications: unknown[];
      };
    }>('/api/data/backup');
    exportWorkspacePdf({
      displayName: profile?.displayName || 'Developer',
      exportedAt: backup.exportedAt,
      tasksCount: backup.data.tasks.length,
      completedTasksCount: backup.data.tasks.filter((t) => t.status === 'Completed').length,
      projectsCount: backup.data.projects.length,
      learningGoalsCount: backup.data.learningGoals.length,
      focusSessionsCount: backup.data.focusSessions.length,
      applicationsCount: backup.data.jobApplications.length,
      certificationsCount: backup.data.certifications.length,
    });
    setDataMsg('Exported PDF workspace summary.');
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setDataMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await apiFetch<{ restoredCount: number }>('/api/data/restore', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      setDataMsg(`Restored ${res.restoredCount} records from backup.`);
    } catch (err: unknown) {
      setDataMsg(err instanceof Error ? err.message : 'Invalid backup file.');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings & Preferences</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure your profile, streak timezone, notifications, and appearance.
        </p>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Profile */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold">Developer Profile & Portfolio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Public Portfolio Slug
              </label>
              <input
                type="text"
                value={portfolioSlug}
                onChange={(e) => setPortfolioSlug(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
              >
                {[
                  'UTC',
                  'America/Los_Angeles',
                  'America/New_York',
                  'America/Chicago',
                  'Europe/London',
                  'Europe/Berlin',
                  'Africa/Nairobi',
                  'Asia/Tokyo',
                  'Asia/Kolkata',
                  'Australia/Sydney',
                ].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Daily Commitment Target
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={dailyCommitmentTarget}
                onChange={(e) => setDailyCommitmentTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* Notifications & Reminders */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold">Notifications & Reminders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={deadlineAlerts}
                onChange={(e) => setDeadlineAlerts(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              <span>Upcoming & overdue deadline alerts</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={streakReminders}
                onChange={(e) => setStreakReminders(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              <span>Daily streak commitment reminders</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={milestoneAlerts}
                onChange={(e) => setMilestoneAlerts(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              <span>Project & learning milestone alerts</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={publicPortfolioEnabled}
                onChange={(e) => setPublicPortfolioEnabled(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600"
              />
              <span>Enable public portfolio view</span>
            </label>
          </div>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Preferred Reminder Time
            </label>
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
            />
          </div>
        </div>

        {/* Theme */}
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Interface Theme</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Switch between light and dark surface contrast.
            </p>
          </div>
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-800 text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-emerald-600 dark:text-emerald-400">{statusMsg}</div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Data Management: CSV, PDF & Backup/Restore */}
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">Data Management & Exports</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Export CSV spreadsheets, download PDF summaries, or create and restore full JSON backups.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500">CSV Exports</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['tasks', 'Tasks CSV'],
                ['projects', 'Projects CSV'],
                ['focus', 'Focus Sessions CSV'],
                ['learning', 'Learning Goals CSV'],
                ['career', 'Career Applications CSV'],
              ] as const
            ).map(([entity, label]) => (
              <button
                key={entity}
                type="button"
                onClick={() => handleDownloadCsv(entity)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportPdfSummary}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>Export PDF Summary</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadBackupJson}
            className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON Backup</span>
          </button>

          <label className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-amber-500" />
            <span>{restoring ? 'Restoring...' : 'Restore JSON Backup'}</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleRestoreFile}
              disabled={restoring}
              className="hidden"
            />
          </label>
        </div>

        {dataMsg && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400">{dataMsg}</div>
        )}
      </div>
    </div>
  );
};
