import { useState } from 'react';
import { Check, Copy, Download, Heart, RefreshCw, Smartphone, X } from 'lucide-react';

interface DownloadModalProps {
  open: boolean;
  onClose: () => void;
  inviteKey?: string;
  onRotateInviteKey: () => Promise<void>;
  canInstallPwa: boolean;
  onInstallPwa: () => Promise<void>;
}

export function DownloadModal({
  open,
  onClose,
  inviteKey,
  onRotateInviteKey,
  canInstallPwa,
  onInstallPwa,
}: DownloadModalProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [rotating, setRotating] = useState(false);

  if (!open) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const gfInviteUrl = inviteKey
    ? `${appUrl}/?partner=gf&invite=${encodeURIComponent(inviteKey)}`
    : appUrl;
  const zipDownloadUrl = `${appUrl}/api/download-source`;

  async function handleCopyInvite() {
    try {
      await navigator.clipboard.writeText(gfInviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  async function handleRotate() {
    setRotating(true);
    try {
      await onRotateInviteKey();
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Invite Your Girlfriend & Download
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Send her this private link to chat, snap, and call in real time
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Private Girlfriend Invite Link */}
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-slate-950 border border-amber-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Heart className="w-4 h-4 text-rose-500" />
              Private Invite Link for Your GF
            </div>
            <button
              type="button"
              onClick={handleRotate}
              disabled={rotating}
              title="Generate a fresh invite key"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <RefreshCw className={`w-3 h-3 ${rotating ? 'animate-spin' : ''}`} />
              Reset Link
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            When she opens this link on her phone or laptop, she connects directly to your private
            2-person room in real time.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={gfInviteUrl}
              className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300"
            />
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 min-h-[40px] shrink-0"
            >
              {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedInvite ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* 2. Install as Mobile / Desktop App */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Smartphone className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            Install on Your Phone
          </div>
          {canInstallPwa ? (
            <button
              type="button"
              onClick={onInstallPwa}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-semibold text-sm hover:opacity-90 transition-opacity min-h-[44px]"
            >
              Install SnapLoom App
            </button>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              On mobile, tap Share / Browser Menu and pick <strong>Add to Home Screen</strong> so
              it opens full-screen like a native app.
            </p>
          )}
        </div>

        {/* 3. Source Code ZIP Download */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Need the source files?
          </div>
          <a
            href={zipDownloadUrl}
            download="snaploom-app.zip"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download .zip
          </a>
        </div>
      </div>
    </div>
  );
}
