import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, FolderKanban, Github } from 'lucide-react';
import { ProjectItem } from '../types';

interface PublicPortfolioViewProps {
  slug: string;
  onExit?: () => void;
}

interface PublicPortfolioResponse {
  owner: {
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    portfolioSlug: string;
  };
  projects: ProjectItem[];
}

export const PublicPortfolioView: React.FC<PublicPortfolioViewProps> = ({ slug, onExit }) => {
  const [data, setData] = useState<PublicPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cleanSlug = slug.replace(/^<|>$/g, '').trim().toLowerCase();
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?portfolio=${encodeURIComponent(data?.owner.portfolioSlug || cleanSlug)}`
      : '';

  const handleCopyShareUrl = async () => {
    if (!shareUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/public/${encodeURIComponent(cleanSlug)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Portfolio not found.');
        return res.json();
      })
      .then((json: PublicPortfolioResponse) => setData(json))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Unable to load portfolio.')
      )
      .finally(() => setLoading(false));
  }, [cleanSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-xs text-slate-500">
        Loading developer portfolio...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-sm font-medium">{error || 'Portfolio unavailable'}</div>
        <p className="mt-1.5 text-xs text-slate-500 max-w-md">
          Make sure the URL uses your saved portfolio slug without angle brackets, for example:{' '}
          <code className="font-mono text-emerald-600 dark:text-emerald-400">?portfolio=my-slug</code>
        </p>
        {onExit && (
          <button
            onClick={onExit}
            className="mt-4 px-4 py-2 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs cursor-pointer"
          >
            Return to Workspace
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <img
              src={data.owner.avatarUrl || '/src/assets/images/avatar_developer_default_1794680297404.jpg'}
              alt={data.owner.displayName}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{data.owner.displayName}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mt-0.5">
                {data.owner.bio}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyShareUrl}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? 'Copied Link' : 'Copy Portfolio Link'}</span>
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Workspace</span>
              </button>
            )}
          </div>
        </div>

        {data.projects.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <FolderKanban className="w-8 h-8 mx-auto text-slate-400" />
            <div className="mt-2 text-sm font-medium">No published projects yet</div>
            <p className="mt-1 text-xs text-slate-500">
              Private projects remain hidden from public visitors.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.projects.map((p) => (
              <article
                key={p.id}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {p.coverImageUrl && (
                    <img
                      src={p.coverImageUrl}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-6 space-y-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {p.category} · {p.status} · {p.role}
                    </div>
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {p.description}
                    </p>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {[...(p.technologies || []), ...(p.frameworks || [])].join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs">
                  {p.githubUrl && (
                    <a
                      href={p.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium hover:text-emerald-500"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>Repository</span>
                    </a>
                  )}
                  {p.liveUrl && (
                    <a
                      href={p.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Live Demo</span>
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
