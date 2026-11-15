import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  BookText,
  Briefcase,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Flame,
  FolderKanban,
  GitBranch,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Timer,
  X,
} from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { CalendarView } from './components/CalendarView';
import { CareerView } from './components/CareerView';
import { DailyPlanningView } from './components/DailyPlanningView';
import { DashboardView } from './components/DashboardView';
import { FocusView } from './components/FocusView';
import { GeminiCoachDrawer } from './components/GeminiCoachDrawer';
import { GitHubView } from './components/GitHubView';
import { JournalView } from './components/JournalView';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { LearningView } from './components/LearningView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ProjectsView } from './components/ProjectsView';
import { PublicPortfolioView } from './components/PublicPortfolioView';
import { QuickTaskModal } from './components/QuickTaskModal';
import { SettingsView } from './components/SettingsView';
import { SignInGate } from './components/SignInGate';
import { StreakView } from './components/StreakView';
import { TasksView } from './components/TasksView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiFetch } from './lib/api';
import { NavTab, NotificationItem, ProjectItem, TaskCategory } from './types';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'planning', label: 'Daily Plan', icon: ClipboardCheck },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'focus', label: 'Focus Mode', icon: Timer },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'streaks', label: 'Streak Tracker', icon: Flame },
  { id: 'github', label: 'GitHub Activity', icon: GitBranch },
  { id: 'projects', label: 'My Projects', icon: FolderKanban },
  { id: 'learning', label: 'Learning Goals', icon: BookOpen },
  { id: 'career', label: 'Career', icon: Briefcase },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'journal', label: 'Journal', icon: BookText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const AppShell: React.FC = () => {
  const { firebaseUser, profile, loading, theme, setTheme, signOut, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [previewPortfolioSlug, setPreviewPortfolioSlug] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('portfolio');
  });

  const bumpRefresh = () => setRefreshTrigger((n) => n + 1);

  useEffect(() => {
    if (!firebaseUser) return;
    apiFetch<{ notifications: NotificationItem[] }>('/api/settings/notifications')
      .then((res) => setNotifications(res.notifications))
      .catch(() => {});
    apiFetch<{ categories: TaskCategory[] }>('/api/tasks')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
    apiFetch<{ projects: ProjectItem[] }>('/api/projects')
      .then((res) => setProjects(res.projects))
      .catch(() => {});
  }, [firebaseUser, refreshTrigger]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setQuickTaskOpen(true);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setCoachOpen((o) => !o);
        return;
      }
      if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const tabMap: Record<string, NavTab> = {
          '1': 'dashboard',
          '2': 'planning',
          '3': 'tasks',
          '4': 'focus',
        };
        setActiveTab(tabMap[e.key]);
        return;
      }
      if (e.key === 'Escape') {
        setQuickTaskOpen(false);
        setCoachOpen(false);
        setShortcutsOpen(false);
        setNotifOpen(false);
        return;
      }
      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (previewPortfolioSlug) {
    return (
      <PublicPortfolioView
        slug={previewPortfolioSlug}
        onExit={
          firebaseUser
            ? () => {
                setPreviewPortfolioSlug(null);
                const url = new URL(window.location.href);
                url.searchParams.delete('portfolio');
                window.history.replaceState({}, '', url.toString());
              }
            : undefined
        }
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs text-slate-500">
        Initializing workspace...
      </div>
    );
  }

  if (!firebaseUser) {
    return <SignInGate />;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleQuickSaveTask = async (payload: Record<string, unknown>) => {
    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    bumpRefresh();
  };

  const handleMarkNotificationRead = async (n: NotificationItem) => {
    await apiFetch(`/api/settings/notifications/${n.id}/read`, { method: 'PATCH' });
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
    );
    if (n.linkTab) setActiveTab(n.linkTab);
    setNotifOpen(false);
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/api/settings/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const activeNavLabel = NAV_ITEMS.find((i) => i.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold tracking-tight whitespace-nowrap truncate">
              Progress Tracker
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 dark:bg-emerald-500/15 text-white dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full">
            <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold">Progress Tracker</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                      active
                        ? 'bg-slate-900 dark:bg-emerald-500/15 text-white dark:text-emerald-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-14 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline whitespace-nowrap">
              Workspace / {activeNavLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search workspace (⌘K)..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs w-52 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <PWAInstallButton />

            <button
              onClick={() => setCoachOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
              title="Engineering Coach (Alt+J)"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Coach</span>
            </button>

            <button
              onClick={() => setShortcutsOpen(true)}
              className="hidden sm:inline-flex p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 relative cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono leading-[14px] text-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No notifications right now.
                      </div>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleMarkNotificationRead(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                            !n.isRead ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          <div className="text-xs font-medium">{n.title}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {n.message}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setQuickTaskOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quick Task</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 pl-1 cursor-pointer"
              title={profile?.displayName || firebaseUser.email || 'Profile'}
            >
              <img
                src={
                  profile?.avatarUrl ||
                  firebaseUser.photoURL ||
                  '/src/assets/images/avatar_developer_default_1794680297404.jpg'
                }
                alt={profile?.displayName || 'Developer avatar'}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div className="md:hidden mb-4 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search tasks, projects, goals, journal..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onOpenQuickTask={() => setQuickTaskOpen(true)}
              refreshTrigger={refreshTrigger}
              onWorkspaceSeeded={bumpRefresh}
            />
          )}
          {activeTab === 'planning' && (
            <DailyPlanningView
              refreshTrigger={refreshTrigger}
              onTasksChanged={bumpRefresh}
            />
          )}
          {activeTab === 'tasks' && (
            <TasksView
              globalSearch={globalSearch}
              onTasksChanged={bumpRefresh}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'focus' && (
            <FocusView
              refreshTrigger={refreshTrigger}
              onSessionCompleted={bumpRefresh}
            />
          )}
          {activeTab === 'calendar' && (
            <CalendarView
              refreshTrigger={refreshTrigger}
              onTasksChanged={bumpRefresh}
            />
          )}
          {activeTab === 'streaks' && (
            <StreakView
              refreshTrigger={refreshTrigger}
              onProfileUpdated={() => {
                refreshProfile();
                bumpRefresh();
              }}
            />
          )}
          {activeTab === 'github' && (
            <GitHubView
              refreshTrigger={refreshTrigger}
              onSyncCompleted={bumpRefresh}
            />
          )}
          {activeTab === 'projects' && (
            <ProjectsView
              globalSearch={globalSearch}
              refreshTrigger={refreshTrigger}
              onProjectsChanged={bumpRefresh}
              onPreviewPublicPortfolio={(slug) => setPreviewPortfolioSlug(slug)}
            />
          )}
          {activeTab === 'learning' && (
            <LearningView
              globalSearch={globalSearch}
              refreshTrigger={refreshTrigger}
              onLearningChanged={bumpRefresh}
            />
          )}
          {activeTab === 'career' && <CareerView refreshTrigger={refreshTrigger} />}
          {activeTab === 'analytics' && (
            <AnalyticsView refreshTrigger={refreshTrigger} />
          )}
          {activeTab === 'journal' && (
            <JournalView
              globalSearch={globalSearch}
              refreshTrigger={refreshTrigger}
            />
          )}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      <QuickTaskModal
        isOpen={quickTaskOpen}
        onClose={() => setQuickTaskOpen(false)}
        onSave={handleQuickSaveTask}
        categories={categories}
        projects={projects}
      />

      <GeminiCoachDrawer isOpen={coachOpen} onClose={() => setCoachOpen(false)} />

      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
