import React, { useEffect, useState } from 'react';
import {
  Award,
  Briefcase,
  Check,
  Code2,
  ExternalLink,
  Flag,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { CareerDashboardData, JobApplication } from '../types';

interface CareerViewProps {
  refreshTrigger: number;
}

type CareerTab = 'applications' | 'prep' | 'certifications' | 'milestones';

const APP_STATUSES: JobApplication['status'][] = [
  'Saved',
  'Applied',
  'Phone Screen',
  'Technical',
  'Final',
  'Offer',
  'Rejected',
];

export const CareerView: React.FC<CareerViewProps> = ({ refreshTrigger }) => {
  const [data, setData] = useState<CareerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CareerTab>('applications');

  // Application form
  const [company, setCompany] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [appStatus, setAppStatus] = useState<JobApplication['status']>('Applied');
  const [location, setLocation] = useState('Remote');
  const [salaryRange, setSalaryRange] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [appNotes, setAppNotes] = useState('');

  // Prep form
  const [prepTopic, setPrepTopic] = useState('');
  const [prepCompany, setPrepCompany] = useState('General');
  const [prepCategory, setPrepCategory] = useState<'DSA' | 'System Design' | 'Behavioral' | 'Domain'>('DSA');
  const [prepDifficulty, setPrepDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [prepMinutes, setPrepMinutes] = useState('45');
  const [prepFeedback, setPrepFeedback] = useState('');
  const [prepImprovement, setPrepImprovement] = useState('');

  // Certification form
  const [certName, setCertName] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certStatus, setCertStatus] = useState<'In Progress' | 'Earned' | 'Expired'>('In Progress');
  const [certEarnedDate, setCertEarnedDate] = useState('');
  const [certUrl, setCertUrl] = useState('');

  // Milestone form
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneTargetDate, setMilestoneTargetDate] = useState('');
  const [milestoneNotes, setMilestoneNotes] = useState('');

  const loadCareer = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<CareerDashboardData>('/api/career');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCareer();
  }, [refreshTrigger]);

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !roleTitle.trim()) return;
    await apiFetch('/api/career/applications', {
      method: 'POST',
      body: JSON.stringify({
        company,
        roleTitle,
        status: appStatus,
        appliedDate: new Date().toISOString().slice(0, 10),
        location,
        salaryRange,
        jobUrl,
        notes: appNotes,
      }),
    });
    setCompany('');
    setRoleTitle('');
    setSalaryRange('');
    setJobUrl('');
    setAppNotes('');
    await loadCareer();
  };

  const handleUpdateApplicationStatus = async (id: string, status: JobApplication['status']) => {
    await apiFetch(`/api/career/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadCareer();
  };

  const handleDeleteApplication = async (id: string) => {
    await apiFetch(`/api/career/applications/${id}`, { method: 'DELETE' });
    await loadCareer();
  };

  const handleAddPrep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prepTopic.trim()) return;
    await apiFetch('/api/career/prep', {
      method: 'POST',
      body: JSON.stringify({
        topic: prepTopic,
        company: prepCompany,
        category: prepCategory,
        difficulty: prepDifficulty,
        durationMinutes: Number(prepMinutes) || 45,
        feedback: prepFeedback,
        improvementNotes: prepImprovement,
      }),
    });
    setPrepTopic('');
    setPrepFeedback('');
    setPrepImprovement('');
    await loadCareer();
  };

  const handleDeletePrep = async (id: string) => {
    await apiFetch(`/api/career/prep/${id}`, { method: 'DELETE' });
    await loadCareer();
  };

  const handleAddCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certName.trim() || !certIssuer.trim()) return;
    await apiFetch('/api/career/certifications', {
      method: 'POST',
      body: JSON.stringify({
        name: certName,
        issuer: certIssuer,
        status: certStatus,
        earnedDate: certEarnedDate || null,
        credentialUrl: certUrl,
      }),
    });
    setCertName('');
    setCertIssuer('');
    setCertEarnedDate('');
    setCertUrl('');
    await loadCareer();
  };

  const handleDeleteCert = async (id: string) => {
    await apiFetch(`/api/career/certifications/${id}`, { method: 'DELETE' });
    await loadCareer();
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim()) return;
    await apiFetch('/api/career/milestones', {
      method: 'POST',
      body: JSON.stringify({
        title: milestoneTitle,
        targetDate: milestoneTargetDate || null,
        notes: milestoneNotes,
      }),
    });
    setMilestoneTitle('');
    setMilestoneTargetDate('');
    setMilestoneNotes('');
    await loadCareer();
  };

  const handleToggleMilestone = async (id: string, current: boolean) => {
    await apiFetch(`/api/career/milestones/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted: !current }),
    });
    await loadCareer();
  };

  const handleDeleteMilestone = async (id: string) => {
    await apiFetch(`/api/career/milestones/${id}`, { method: 'DELETE' });
    await loadCareer();
  };

  const apps = data?.applications || [];
  const prep = data?.prepRecords || [];
  const certs = data?.certifications || [];
  const milestones = data?.milestones || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Career Development</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Track job applications, technical interview practice, certifications, and long-term career milestones.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Applications Tracked</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">{apps.length}</div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {apps.filter((a) => ['Phone Screen', 'Technical', 'Final', 'Offer'].includes(a.status)).length}{' '}
            active pipeline
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Interview Prep Sessions</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">{prep.length}</div>
          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
            {Math.round(prep.reduce((acc, p) => acc + p.durationMinutes, 0) / 60)}h practiced
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Certifications</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {certs.filter((c) => c.status === 'Earned').length}/{certs.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">earned credentials</div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500">Career Milestones</div>
          <div className="mt-1.5 text-2xl font-semibold font-mono tabular-nums">
            {milestones.filter((m) => m.isCompleted).length}/{milestones.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">achieved</div>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {(
          [
            ['applications', 'Job Applications', Briefcase],
            ['prep', 'Interview Prep & Notes', Code2],
            ['certifications', 'Certifications', Award],
            ['milestones', 'Career Milestones', Flag],
          ] as Array<[CareerTab, string, React.FC<{ className?: string }>]>
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="p-8 text-xs text-slate-500">Loading career data...</div>
      ) : (
        <>
          {activeTab === 'applications' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleAddApplication}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 h-fit"
              >
                <h2 className="text-sm font-semibold">Log Job Application</h2>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="Role title (e.g. Senior Backend Engineer)"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={appStatus}
                    onChange={(e) => setAppStatus(e.target.value as JobApplication['status'])}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    {APP_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Location"
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
                <input
                  type="text"
                  value={salaryRange}
                  onChange={(e) => setSalaryRange(e.target.value)}
                  placeholder="Compensation range (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <input
                  type="url"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="Job posting URL (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <textarea
                  rows={2}
                  value={appNotes}
                  onChange={(e) => setAppNotes(e.target.value)}
                  placeholder="Recruiter contacts, role notes..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Application</span>
                </button>
              </form>

              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
                {apps.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    No job applications logged yet.
                  </div>
                ) : (
                  apps.map((app) => (
                    <div key={app.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{app.company}</span>
                          <span className="text-xs text-slate-500">· {app.roleTitle}</span>
                          {app.jobUrl && (
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-emerald-500"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {app.location}
                          {app.salaryRange ? ` · ${app.salaryRange}` : ''}
                          {app.appliedDate ? ` · Applied ${app.appliedDate}` : ''}
                        </div>
                        {app.notes && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {app.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={app.status}
                          onChange={(e) =>
                            handleUpdateApplicationStatus(
                              app.id,
                              e.target.value as JobApplication['status']
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          {APP_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDeleteApplication(app.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'prep' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleAddPrep}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 h-fit"
              >
                <h2 className="text-sm font-semibold">Log Practice & Feedback</h2>
                <input
                  type="text"
                  value={prepTopic}
                  onChange={(e) => setPrepTopic(e.target.value)}
                  placeholder="Topic (e.g. LRU Cache, Rate Limiter Design)"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={prepCompany}
                    onChange={(e) => setPrepCompany(e.target.value)}
                    placeholder="Company / Target"
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                  <input
                    type="number"
                    min={5}
                    value={prepMinutes}
                    onChange={(e) => setPrepMinutes(e.target.value)}
                    placeholder="Minutes"
                    className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={prepCategory}
                    onChange={(e) => setPrepCategory(e.target.value as typeof prepCategory)}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <option value="DSA">DSA</option>
                    <option value="System Design">System Design</option>
                    <option value="Behavioral">Behavioral</option>
                    <option value="Domain">Domain</option>
                  </select>
                  <select
                    value={prepDifficulty}
                    onChange={(e) => setPrepDifficulty(e.target.value as typeof prepDifficulty)}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={prepFeedback}
                  onChange={(e) => setPrepFeedback(e.target.value)}
                  placeholder="Interview feedback / self-evaluation..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <textarea
                  rows={2}
                  value={prepImprovement}
                  onChange={(e) => setPrepImprovement(e.target.value)}
                  placeholder="Improvement notes for next session..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
                >
                  Save Practice Record
                </button>
              </form>

              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
                {prep.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    No technical interview practice sessions logged yet.
                  </div>
                ) : (
                  prep.map((p) => (
                    <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="text-sm font-semibold">{p.topic}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {p.category} · {p.difficulty} · {p.company} · {p.durationMinutes}m ·{' '}
                          {p.practiceDate}
                        </div>
                        {p.feedback && (
                          <div className="text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-medium">Feedback:</span> {p.feedback}
                          </div>
                        )}
                        {p.improvementNotes && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            <span className="font-medium">Next Improvement:</span>{' '}
                            {p.improvementNotes}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeletePrep(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'certifications' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleAddCert}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 h-fit"
              >
                <h2 className="text-sm font-semibold">Add Certification</h2>
                <input
                  type="text"
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  placeholder="Certification name"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <input
                  type="text"
                  value={certIssuer}
                  onChange={(e) => setCertIssuer(e.target.value)}
                  placeholder="Issuing organization (e.g. Google Cloud, AWS)"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={certStatus}
                    onChange={(e) => setCertStatus(e.target.value as typeof certStatus)}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Earned">Earned</option>
                    <option value="Expired">Expired</option>
                  </select>
                  <input
                    type="date"
                    value={certEarnedDate}
                    onChange={(e) => setCertEarnedDate(e.target.value)}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                </div>
                <input
                  type="url"
                  value={certUrl}
                  onChange={(e) => setCertUrl(e.target.value)}
                  placeholder="Credential verification URL"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
                >
                  Save Certification
                </button>
              </form>

              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
                {certs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    No certifications added yet.
                  </div>
                ) : (
                  certs.map((c) => (
                    <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{c.name}</span>
                          {c.credentialUrl && (
                            <a
                              href={c.credentialUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 dark:text-emerald-400"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.issuer} · {c.status}
                          {c.earnedDate ? ` · ${c.earnedDate}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCert(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'milestones' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleAddMilestone}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 h-fit"
              >
                <h2 className="text-sm font-semibold">Add Career Milestone</h2>
                <input
                  type="text"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="e.g. Publish distributed systems case study"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <input
                  type="date"
                  value={milestoneTargetDate}
                  onChange={(e) => setMilestoneTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                />
                <textarea
                  rows={2}
                  value={milestoneNotes}
                  onChange={(e) => setMilestoneNotes(e.target.value)}
                  placeholder="Success criteria..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium cursor-pointer"
                >
                  Add Milestone
                </button>
              </form>

              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
                {milestones.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    No career milestones created yet.
                  </div>
                ) : (
                  milestones.map((m) => (
                    <div key={m.id} className="p-4 flex items-start justify-between gap-3">
                      <button
                        onClick={() => handleToggleMilestone(m.id, m.isCompleted)}
                        className="flex items-start gap-3 text-left cursor-pointer"
                      >
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                            m.isCompleted
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {m.isCompleted && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <div>
                          <div
                            className={`text-sm font-medium ${
                              m.isCompleted ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {m.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {m.targetDate ? `Target: ${m.targetDate}` : 'No target date'}
                            {m.notes ? ` · ${m.notes}` : ''}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteMilestone(m.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
