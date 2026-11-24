import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import type { UserProfile } from '../types';
import { AvatarView } from './AvatarView';

interface AuthModalProps {
  open: boolean;
  onClose?: () => void;
  partners: UserProfile[];
  pinEnabled: boolean;
  onAuthSuccess: (token: string, user: UserProfile) => void;
}

export function AuthModal({
  open,
  onClose,
  partners,
  pinEnabled,
  onAuthSuccess,
}: AuthModalProps) {
  const [selectedRole, setSelectedRole] = useState<'you' | 'gf'>('you');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleEnter(role: 'you' | 'gf') {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, pin: pinEnabled ? pin : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not enter private room');
        return;
      }
      setPin('');
      onAuthSuccess(data.token, data.user);
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Private Space for Two
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose which partner device this is
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="space-y-2.5">
          {partners.map((p) => {
            const active = selectedRole === p.partnerRole;
            return (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => {
                  setSelectedRole(p.partnerRole);
                  if (!pinEnabled) {
                    void handleEnter(p.partnerRole);
                  }
                }}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border transition-colors text-left ${
                  active && pinEnabled
                    ? 'border-amber-400 bg-amber-50/40 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-800 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-950/50'
                }`}
              >
                <AvatarView avatar={p.avatar} size={46} alt={p.displayName} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {p.displayName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {p.partnerRole === 'you' ? 'Partner 1 (Your device)' : 'Partner 2 (Girlfriend device)'}
                  </div>
                </div>
                {!pinEnabled && (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                    Enter
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {pinEnabled && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleEnter(selectedRole);
            }}
            className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800"
          >
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              Room PIN Required
            </label>
            <input
              type="password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter your private room PIN"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm hover:bg-amber-300 disabled:opacity-50 min-h-[44px]"
            >
              {loading ? 'Unlocking...' : 'Unlock Private Chat'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
