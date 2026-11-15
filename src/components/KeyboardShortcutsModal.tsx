import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'Ctrl / Cmd + K', desc: 'Focus global workspace search' },
  { keys: 'Alt + N', desc: 'Open Quick Task capture modal' },
  { keys: 'Alt + J', desc: 'Toggle AI Engineering Coach drawer' },
  { keys: 'Alt + 1', desc: 'Go to Dashboard' },
  { keys: 'Alt + 2', desc: 'Go to Daily Plan' },
  { keys: 'Alt + 3', desc: 'Go to My Tasks' },
  { keys: 'Alt + 4', desc: 'Go to Focus Mode' },
  { keys: '?', desc: 'Show / hide keyboard shortcuts' },
  { keys: 'Esc', desc: 'Close open dialog or drawer' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close shortcuts modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 divide-y divide-slate-200 dark:divide-slate-800">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="py-2.5 flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-600 dark:text-slate-300">{s.desc}</span>
              <kbd className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-200 shrink-0">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
