import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderKanban,
  Github,
  Globe,
  ImagePlus,
  Layers,
  LayoutGrid,
  List,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { ProjectFeature, ProjectItem, ProjectRelease } from '../types';

interface ProjectsViewProps {
  globalSearch: string;
  refreshTrigger: number;
  onProjectsChanged: () => void;
  onPreviewPublicPortfolio: (slug: string) => void;
}

const PROJECT_STATUSES: ProjectItem['status'][] = [
  'Planning',
  'In Progress',
  'On Hold',
  'Completed',
  'Archived',
];

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  globalSearch,
  refreshTrigger,
  onProjectsChanged,
  onPreviewPublicPortfolio,
}) => {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState('All');
  const [techFilter, setTechFilter] = useState('All');
  const [search, setSearch] = useState('');

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [category, setCategory] = useState('Web Application');
  const [status, setStatus] = useState<ProjectItem['status']>('In Progress');
  const [role, setRole] = useState('Solo Full-Stack Engineer');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [technologiesText, setTechnologiesText] = useState('');
  const [frameworksText, setFrameworksText] = useState('');
  const [keyFeaturesText, setKeyFeaturesText] = useState('');
  const [challenges, setChallenges] = useState('');
  const [solutions, setSolutions] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Detail sub-forms
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState('');
  const [newScreenshotCaption, setNewScreenshotCaption] = useState('');
  const [newFeatureTitle, setNewFeatureTitle] = useState('');
  const [newFeaturePriority, setNewFeaturePriority] = useState<ProjectFeature['priority']>('Medium');
  const [newReleaseVersion, setNewReleaseVersion] = useState('');
  const [newReleaseTitle, setNewReleaseTitle] = useState('');
  const [newReleaseNotes, setNewReleaseNotes] = useState('');
  const [newLinkedTaskTitle, setNewLinkedTaskTitle] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ projects: ProjectItem[] }>('/api/projects');
      setProjects(res.projects);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [refreshTrigger]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const openEditor = (p: ProjectItem | null) => {
    setEditingProject(p);
    if (p) {
      setName(p.name);
      setDescription(p.description);
      setObjectives(p.objectives || '');
      setCategory(p.category);
      setStatus(p.status);
      setRole(p.role || 'Solo Full-Stack Engineer');
      setGithubUrl(p.githubUrl || '');
      setLiveUrl(p.liveUrl || '');
      setCoverImageUrl(p.coverImageUrl || '');
      setStartDate(p.startDate || '');
      setCompletionDate(p.completionDate || '');
      setTechnologiesText((p.technologies || []).join(', '));
      setFrameworksText((p.frameworks || []).join(', '));
      setKeyFeaturesText((p.keyFeatures || []).join('\n'));
      setChallenges(p.challenges || '');
      setSolutions(p.solutions || '');
      setLessonsLearned(p.lessonsLearned || '');
      setIsPublic(p.isPublic);
    } else {
      setName('');
      setDescription('');
      setObjectives('');
      setCategory('Web Application');
      setStatus('Planning');
      setRole('Solo Full-Stack Engineer');
      setGithubUrl('');
      setLiveUrl('');
      setCoverImageUrl('/src/assets/images/project_cover_telemetry_1794680297025.jpg');
      setStartDate(new Date().toISOString().slice(0, 10));
      setCompletionDate('');
      setTechnologiesText('TypeScript, PostgreSQL');
      setFrameworksText('React, Express');
      setKeyFeaturesText('');
      setChallenges('');
      setSolutions('');
      setLessonsLearned('');
      setIsPublic(false);
    }
    setModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        objectives,
        category,
        status,
        role,
        githubUrl,
        liveUrl,
        coverImageUrl,
        startDate: startDate || null,
        completionDate: completionDate || null,
        technologies: technologiesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        frameworks: frameworksText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        keyFeatures: keyFeaturesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        challenges,
        solutions,
        lessonsLearned,
        isPublic,
      };
      if (editingProject) {
        await apiFetch(`/api/projects/${editingProject.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadProjects();
      onProjectsChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (selectedProjectId === id) setSelectedProjectId(null);
    await loadProjects();
    onProjectsChanged();
  };

  const handleTogglePublic = async (p: ProjectItem) => {
    await apiFetch(`/api/projects/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic: !p.isPublic }),
    });
    await loadProjects();
  };

  const handleAddMilestone = async (projectId: string) => {
    if (!newMilestoneTitle.trim()) return;
    await apiFetch(`/api/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify({
        title: newMilestoneTitle.trim(),
        dueDate: newMilestoneDue || null,
      }),
    });
    setNewMilestoneTitle('');
    setNewMilestoneDue('');
    await loadProjects();
  };

  const handleToggleMilestone = async (milestoneId: string, current: boolean) => {
    await apiFetch(`/api/projects/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted: !current }),
    });
    await loadProjects();
    onProjectsChanged();
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    await apiFetch(`/api/projects/milestones/${milestoneId}`, { method: 'DELETE' });
    await loadProjects();
  };

  const handleUploadScreenshotFile = async (
    projectId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      await apiFetch(`/api/projects/${projectId}/images`, {
        method: 'POST',
        body: JSON.stringify({
          imageUrl: dataUrl,
          caption: newScreenshotCaption || file.name,
        }),
      });
      setNewScreenshotCaption('');
      await loadProjects();
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteImage = async (imageId: string) => {
    await apiFetch(`/api/projects/images/${imageId}`, { method: 'DELETE' });
    await loadProjects();
  };

  const handleAddFeature = async (projectId: string) => {
    if (!newFeatureTitle.trim()) return;
    await apiFetch(`/api/projects/${projectId}/features`, {
      method: 'POST',
      body: JSON.stringify({ title: newFeatureTitle.trim(), priority: newFeaturePriority }),
    });
    setNewFeatureTitle('');
    await loadProjects();
  };

  const handleCycleFeatureStatus = async (feature: ProjectFeature) => {
    const order: ProjectFeature['status'][] = ['Planned', 'In Progress', 'Shipped'];
    const next = order[(order.indexOf(feature.status) + 1) % order.length];
    await apiFetch(`/api/projects/features/${feature.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    await loadProjects();
  };

  const handleDeleteFeature = async (featureId: string) => {
    await apiFetch(`/api/projects/features/${featureId}`, { method: 'DELETE' });
    await loadProjects();
  };

  const handleAddRelease = async (projectId: string) => {
    if (!newReleaseVersion.trim() || !newReleaseTitle.trim()) return;
    await apiFetch(`/api/projects/${projectId}/releases`, {
      method: 'POST',
      body: JSON.stringify({
        version: newReleaseVersion.trim(),
        title: newReleaseTitle.trim(),
        releaseNotes: newReleaseNotes.trim(),
        releaseDate: new Date().toISOString().slice(0, 10),
        status: 'Released',
      }),
    });
    setNewReleaseVersion('');
    setNewReleaseTitle('');
    setNewReleaseNotes('');
    await loadProjects();
  };

  const handleToggleReleaseStatus = async (rel: ProjectRelease) => {
    const next = rel.status === 'Released' ? 'Planned' : 'Released';
    await apiFetch(`/api/projects/releases/${rel.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    await loadProjects();
  };

  const handleDeleteRelease = async (releaseId: string) => {
    await apiFetch(`/api/projects/releases/${releaseId}`, { method: 'DELETE' });
    await loadProjects();
  };

  const handleAddLinkedTask = async (projectId: string) => {
    if (!newLinkedTaskTitle.trim()) return;
    await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: newLinkedTaskTitle.trim(),
        projectId,
        dueDate: new Date().toISOString().slice(0, 10),
      }),
    });
    setNewLinkedTaskTitle('');
    await loadProjects();
    onProjectsChanged();
  };

  const handleToggleLinkedTask = async (taskId: string, currentStatus: string) => {
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: currentStatus === 'Completed' ? 'Pending' : 'Completed' }),
    });
    await loadProjects();
    onProjectsChanged();
  };

  const allTechnologies = useMemo(() => {
    const set = new Set<string>(['All']);
    projects.forEach((p) => {
      p.technologies?.forEach((t) => set.add(t));
      p.frameworks?.forEach((f) => set.add(f));
    });
    return Array.from(set);
  }, [projects]);

  const query = (search || globalSearch).trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => (statusFilter === 'All' ? true : p.status === statusFilter))
      .filter((p) =>
        techFilter === 'All'
          ? true
          : p.technologies?.includes(techFilter) || p.frameworks?.includes(techFilter)
      )
      .filter((p) => {
        if (!query) return true;
        return (
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.technologies.some((t) => t.toLowerCase().includes(query))
        );
      });
  }, [projects, statusFilter, techFilter, query]);

  // Project Detail View
  if (selectedProject) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => setSelectedProjectId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTogglePublic(selectedProject)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {selectedProject.isPublic ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Public on Portfolio</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Private Project</span>
                </>
              )}
            </button>
            <button
              onClick={() => openEditor(selectedProject)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => handleDeleteProject(selectedProject.id)}
              className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {selectedProject.coverImageUrl && (
            <div className="h-56 sm:h-72 bg-slate-950 relative overflow-hidden">
              <img
                src={selectedProject.coverImageUrl}
                alt={selectedProject.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <div className="text-xs text-slate-300">
                  {selectedProject.category} · {selectedProject.status} · {selectedProject.role}
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-semibold">
                  {selectedProject.name}
                </h1>
              </div>
            </div>
          )}

          <div className="p-6 space-y-6">
            {!selectedProject.coverImageUrl && (
              <div>
                <div className="text-xs text-slate-500">
                  {selectedProject.category} · {selectedProject.status} · {selectedProject.role}
                </div>
                <h1 className="mt-1 text-2xl font-semibold">{selectedProject.name}</h1>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                {selectedProject.startDate && (
                  <span className="font-mono">Started: {selectedProject.startDate}</span>
                )}
                {selectedProject.completionDate && (
                  <span className="font-mono">Completed: {selectedProject.completionDate}</span>
                )}
                <span className="font-mono tabular-nums">
                  Progress: {selectedProject.progress}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                {selectedProject.githubUrl && (
                  <a
                    href={selectedProject.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-500"
                  >
                    <Github className="w-4 h-4" />
                    <span>Source Code</span>
                  </a>
                )}
                {selectedProject.liveUrl && (
                  <a
                    href={selectedProject.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Live Deployment</span>
                  </a>
                )}
              </div>
            </div>

            {/* Project Progress Analytics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">Milestones</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                  {selectedProject.milestones.filter((m) => m.isCompleted).length}/
                  {selectedProject.milestones.length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">Features Shipped</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                  {(selectedProject.features || []).filter((f) => f.status === 'Shipped').length}/
                  {(selectedProject.features || []).length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">Linked Tasks Done</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                  {(selectedProject.linkedTasks || []).filter((t) => t.status === 'Completed').length}/
                  {(selectedProject.linkedTasks || []).length}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500">Focus Time Logged</div>
                <div className="mt-1 text-lg font-semibold font-mono tabular-nums">
                  {((selectedProject.focusMinutes || 0) / 60).toFixed(1)}h
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div>
                  <h2 className="text-sm font-semibold">Overview</h2>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {selectedProject.description || 'No description provided.'}
                  </p>
                </div>

                {selectedProject.objectives && (
                  <div>
                    <h2 className="text-sm font-semibold">Objectives</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {selectedProject.objectives}
                    </p>
                  </div>
                )}

                {selectedProject.keyFeatures?.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold">Key Features</h2>
                    <ul className="mt-2 space-y-1.5 list-disc list-inside text-sm text-slate-600 dark:text-slate-400">
                      {selectedProject.keyFeatures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(selectedProject.challenges ||
                  selectedProject.solutions ||
                  selectedProject.lessonsLearned) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold">Challenges</div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {selectedProject.challenges || '—'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold">Solutions</div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {selectedProject.solutions || '—'}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold">Lessons Learned</div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {selectedProject.lessonsLearned || '—'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Screenshots Gallery */}
                <div className="pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h2 className="text-sm font-semibold">Screenshots</h2>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newScreenshotCaption}
                        onChange={(e) => setNewScreenshotCaption(e.target.value)}
                        placeholder="Caption (optional)"
                        className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                      <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                        <ImagePlus className="w-3.5 h-3.5" />
                        <span>Upload Screenshot</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadScreenshotFile(selectedProject.id, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                  {selectedProject.images?.length === 0 ? (
                    <p className="text-xs text-slate-500">No screenshots uploaded yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedProject.images.map((img) => (
                        <div
                          key={img.id}
                          className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 relative group"
                        >
                          <img
                            src={img.imageUrl}
                            alt={img.caption || selectedProject.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-44 object-cover"
                          />
                          <div className="px-3 py-2 bg-white dark:bg-slate-900 flex items-center justify-between text-xs">
                            <span className="truncate">{img.caption || 'Screenshot'}</span>
                            <button
                              onClick={() => handleDeleteImage(img.id)}
                              className="text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Feature Development Tracker */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      <h2 className="text-sm font-semibold">Feature Development Tracker</h2>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      Click status to advance
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFeatureTitle}
                      onChange={(e) => setNewFeatureTitle(e.target.value)}
                      placeholder="Track a new feature..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                    <select
                      value={newFeaturePriority}
                      onChange={(e) =>
                        setNewFeaturePriority(e.target.value as ProjectFeature['priority'])
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                    <button
                      onClick={() => handleAddFeature(selectedProject.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {(selectedProject.features || []).length > 0 && (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                      {(selectedProject.features || []).map((f) => (
                        <div key={f.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <span className="font-medium">{f.title}</span>
                            <span className="text-slate-500 ml-2">· {f.priority}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleCycleFeatureStatus(f)}
                              className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                                f.status === 'Shipped'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : f.status === 'In Progress'
                                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {f.status}
                            </button>
                            <button
                              onClick={() => handleDeleteFeature(f.id)}
                              className="text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Releases & Versions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-sm font-semibold">Releases & Versions</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newReleaseVersion}
                      onChange={(e) => setNewReleaseVersion(e.target.value)}
                      placeholder="v1.2.0"
                      className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={newReleaseTitle}
                      onChange={(e) => setNewReleaseTitle(e.target.value)}
                      placeholder="Release title..."
                      className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newReleaseNotes}
                      onChange={(e) => setNewReleaseNotes(e.target.value)}
                      placeholder="Changelog / release notes (optional)"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                    <button
                      onClick={() => handleAddRelease(selectedProject.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                    >
                      Log Release
                    </button>
                  </div>
                  {(selectedProject.releases || []).length > 0 && (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                      {(selectedProject.releases || []).map((rel) => (
                        <div key={rel.id} className="p-3 flex items-start justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-medium">
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 mr-2">
                                {rel.version}
                              </span>
                              {rel.title}
                            </div>
                            {rel.releaseNotes && (
                              <div className="text-slate-500 mt-0.5">{rel.releaseNotes}</div>
                            )}
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {rel.releaseDate || 'Unscheduled'} · {rel.status}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleReleaseStatus(rel)}
                              className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px] cursor-pointer"
                            >
                              {rel.status === 'Released' ? 'Mark Planned' : 'Mark Released'}
                            </button>
                            <button
                              onClick={() => handleDeleteRelease(rel.id)}
                              className="text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Stack & Milestones */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold">Technologies & Frameworks</h2>
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Languages & Tools:{' '}
                      </span>
                      {selectedProject.technologies?.join(' · ') || 'None'}
                    </div>
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        Frameworks:{' '}
                      </span>
                      {selectedProject.frameworks?.join(' · ') || 'None'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold">Project Milestones</h2>
                    <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {selectedProject.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-3">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${selectedProject.progress}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {selectedProject.milestones?.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start justify-between gap-2 text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <button
                          onClick={() => handleToggleMilestone(m.id, m.isCompleted)}
                          className="flex items-start gap-2 text-left cursor-pointer"
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              m.isCompleted
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {m.isCompleted && <Check className="w-3 h-3" />}
                          </span>
                          <div>
                            <div className={m.isCompleted ? 'line-through text-slate-400' : ''}>
                              {m.title}
                            </div>
                            {m.dueDate && (
                              <div className="text-[11px] font-mono text-slate-500">
                                {m.dueDate}
                              </div>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeleteMilestone(m.id)}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      placeholder="New milestone title..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={newMilestoneDue}
                        onChange={(e) => setNewMilestoneDue(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                      <button
                        onClick={() => handleAddMilestone(selectedProject.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Linked Project Tasks */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-sm font-semibold">Linked Tasks</h2>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLinkedTaskTitle}
                      onChange={(e) => setNewLinkedTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLinkedTask(selectedProject.id);
                        }
                      }}
                      placeholder="Add task to project..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                    <button
                      onClick={() => handleAddLinkedTask(selectedProject.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {(selectedProject.linkedTasks || []).length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No tasks linked yet. Link tasks here or from My Tasks.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(selectedProject.linkedTasks || []).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleToggleLinkedTask(t.id, t.status)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left text-xs cursor-pointer"
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              t.status === 'Completed'
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {t.status === 'Completed' && <Check className="w-3 h-3" />}
                          </span>
                          <span
                            className={`truncate flex-1 ${
                              t.status === 'Completed' ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {t.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Projects & Portfolio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Document technical architecture, milestones, screenshots, and publish selected work.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {profile?.portfolioSlug && (
            <>
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/?portfolio=${encodeURIComponent(profile.portfolioSlug!)}`;
                  await navigator.clipboard?.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title={`Copy public URL: ?portfolio=${profile.portfolioSlug}`}
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedLink ? 'Copied!' : 'Copy Share Link'}</span>
              </button>
              <button
                onClick={() => onPreviewPublicPortfolio(profile.portfolioSlug!)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>Public Portfolio Mode</span>
              </button>
            </>
          )}
          <button
            onClick={() => openEditor(null)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Filters & Layout Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs w-48"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
          >
            <option value="All">All Statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
          >
            {allTechnologies.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Technologies' : t}
              </option>
            ))}
          </select>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setLayout('grid')}
            className={`p-1.5 rounded-md cursor-pointer ${
              layout === 'grid'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                : 'text-slate-500'
            }`}
            aria-label="Grid layout"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLayout('list')}
            className={`p-1.5 rounded-md cursor-pointer ${
              layout === 'list'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                : 'text-slate-500'
            }`}
            aria-label="List layout"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-xs text-slate-500">Loading projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <FolderKanban className="w-8 h-8 mx-auto text-slate-400" />
          <div className="mt-3 text-sm font-medium">No projects found</div>
          <p className="mt-1 text-xs text-slate-500">
            Create a project entry to track milestones, stack, and portfolio case studies.
          </p>
          <button
            onClick={() => openEditor(null)}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
          >
            Create First Project
          </button>
        </div>
      ) : layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-emerald-500/60 transition-colors cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="h-40 bg-slate-900 relative overflow-hidden">
                  {p.coverImageUrl ? (
                    <img
                      src={p.coverImageUrl}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <FolderKanban className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {p.status} · {p.category} · {p.isPublic ? 'Public' : 'Private'}
                  </div>
                  <h3 className="mt-1 text-base font-semibold truncate">{p.name}</h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {p.description || 'No description provided.'}
                  </p>
                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {[...(p.technologies || []), ...(p.frameworks || [])].join(' · ')}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono tabular-nums text-slate-500">
                  Progress {p.progress}%
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Inspect
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="text-xs text-slate-500">
                    {p.status} · {p.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {p.technologies?.join(' · ')}
                </div>
              </div>
              <div className="text-xs font-mono tabular-nums shrink-0">{p.progress}%</div>
            </div>
          ))}
        </div>
      )}

      {/* Project Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold">
                {editingProject ? 'Edit Project' : 'New Software Project'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProject} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectItem['status'])}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Technologies (comma separated)
                  </label>
                  <input
                    type="text"
                    value={technologiesText}
                    onChange={(e) => setTechnologiesText(e.target.value)}
                    placeholder="TypeScript, PostgreSQL, Docker"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Frameworks & Libraries
                  </label>
                  <input
                    type="text"
                    value={frameworksText}
                    onChange={(e) => setFrameworksText(e.target.value)}
                    placeholder="React, Express, Drizzle ORM"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Live Deployment URL
                  </label>
                  <input
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">My Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Cover Image URL
                  </label>
                  <input
                    type="text"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Objectives
                </label>
                <input
                  type="text"
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Key Features (one per line)
                </label>
                <textarea
                  rows={2}
                  value={keyFeaturesText}
                  onChange={(e) => setKeyFeaturesText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Challenges
                  </label>
                  <textarea
                    rows={2}
                    value={challenges}
                    onChange={(e) => setChallenges(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Solutions
                  </label>
                  <textarea
                    rows={2}
                    value={solutions}
                    onChange={(e) => setSolutions(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Lessons Learned
                  </label>
                  <textarea
                    rows={2}
                    value={lessonsLearned}
                    onChange={(e) => setLessonsLearned(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600"
                />
                <span>Publish this project to my public developer portfolio</span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
