import { useState } from 'react';
import { Check, Download, Lock, LogOut, ShieldCheck } from 'lucide-react';
import type {
  AccessoryStyle,
  AvatarConfig,
  EyewearStyle,
  HairStyle,
  MoodStyle,
  UserProfile,
} from '../types';
import { AvatarView } from './AvatarView';

interface AvatarStudioProps {
  user: UserProfile;
  authToken: string;
  darkMode: boolean;
  pinEnabled: boolean;
  onToggleDarkMode: () => void;
  onSaveProfile: (payload: {
    displayName: string;
    bio: string;
    avatar: AvatarConfig;
  }) => Promise<void>;
  onUpdatePin: (pin: string | null) => Promise<void>;
  onSwitchAccount: () => void;
  onLogout: () => void;
}

const SKIN_TONES = ['#F6D5BE', '#F2C9AC', '#E8B896', '#D99B72', '#B5744B', '#8D5524'];
const HAIR_COLORS = ['#111827', '#1E293B', '#5C3A21', '#A16207', '#DC2626', '#94A3B8'];
const OUTFIT_COLORS = ['#0F172A', '#2563EB', '#059669', '#E11D48', '#D97706', '#4F46E5'];
const BG_GRADIENTS = [
  'from-amber-200 to-orange-200',
  'from-sky-200 to-indigo-200',
  'from-emerald-200 to-teal-200',
  'from-rose-200 to-amber-100',
  'from-slate-200 to-zinc-300',
];

const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'wavy', label: 'Wavy' },
  { id: 'curls', label: 'Curls' },
  { id: 'bob', label: 'Bob' },
  { id: 'buzz', label: 'Buzz' },
  { id: 'bun', label: 'Bun' },
];

const EYEWEAR_OPTIONS: { id: EyewearStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'shades', label: 'Shades' },
];

const ACCESSORY_OPTIONS: { id: AccessoryStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'headphones', label: 'Audio' },
  { id: 'halo', label: 'Halo' },
];

const MOOD_OPTIONS: { id: MoodStyle; label: string }[] = [
  { id: 'smile', label: 'Smile' },
  { id: 'grin', label: 'Grin' },
  { id: 'chill', label: 'Chill' },
  { id: 'wink', label: 'Wink' },
];

export function AvatarStudio({
  user,
  authToken,
  darkMode,
  pinEnabled,
  onToggleDarkMode,
  onSaveProfile,
  onUpdatePin,
  onSwitchAccount,
  onLogout,
}: AvatarStudioProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [avatar, setAvatar] = useState<AvatarConfig>(user.avatar);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  async function handleSave() {
    setSaving(true);
    try {
      await onSaveProfile({ displayName, bio, avatar });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pinInput.trim().length < 4) return;
    await onUpdatePin(pinInput.trim());
    setPinInput('');
    setPinMessage('Room PIN enabled');
    setTimeout(() => setPinMessage(''), 2200);
  }

  async function handleClearPin() {
    await onUpdatePin(null);
    setPinMessage('Room PIN removed');
    setTimeout(() => setPinMessage(''), 2200);
  }

  async function handleExportMyData() {
    const res = await fetch('/api/privacy/export', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snaploom-us-${user.partnerRole}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Profile Preview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-5">
          <AvatarView avatar={avatar} size={96} className="shadow-sm" alt={displayName} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {displayName || user.displayName}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {user.partnerRole === 'you' ? 'Partner 1 (You)' : 'Partner 2 (GF)'} ·{' '}
              {user.streakCount} day streak
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                type="button"
                onClick={onSwitchAccount}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Switch Partner View
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Lock Room
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm hover:bg-amber-300 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 min-h-[44px]"
        >
          {savedNotice ? (
            <>
              <Check className="w-4 h-4" />
              Saved
            </>
          ) : saving ? (
            'Saving...'
          ) : (
            'Save Avatar & Name'
          )}
        </button>
      </div>

      {/* Avatar Customizer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Avatar Studio
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Skin Tone
            </label>
            <div className="flex flex-wrap gap-2.5">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  aria-label={`Skin tone ${tone}`}
                  onClick={() => setAvatar({ ...avatar, skinTone: tone })}
                  style={{ backgroundColor: tone }}
                  className={`w-9 h-9 rounded-full border-2 transition-transform ${
                    avatar.skinTone === tone
                      ? 'border-slate-900 dark:border-amber-400 scale-110'
                      : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Hairstyle
            </label>
            <div className="grid grid-cols-3 gap-2">
              {HAIR_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setAvatar({ ...avatar, hairStyle: style.id })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors min-h-[40px] ${
                    avatar.hairStyle === style.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Hair Color
            </label>
            <div className="flex flex-wrap gap-2.5">
              {HAIR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Hair color ${color}`}
                  onClick={() => setAvatar({ ...avatar, hairColor: color })}
                  style={{ backgroundColor: color }}
                  className={`w-9 h-9 rounded-full border-2 transition-transform ${
                    avatar.hairColor === color
                      ? 'border-slate-900 dark:border-amber-400 scale-110'
                      : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Expression
            </label>
            <div className="grid grid-cols-4 gap-2">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAvatar({ ...avatar, mood: m.id })}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors min-h-[40px] ${
                    avatar.mood === m.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Style & Name
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Eyewear
            </label>
            <div className="grid grid-cols-4 gap-2">
              {EYEWEAR_OPTIONS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setAvatar({ ...avatar, eyewear: e.id })}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors min-h-[40px] ${
                    avatar.eyewear === e.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Accessory
            </label>
            <div className="grid grid-cols-5 gap-2">
              {ACCESSORY_OPTIONS.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setAvatar({ ...avatar, accessory: acc.id })}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors min-h-[40px] ${
                    avatar.accessory === acc.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Outfit & Backdrop
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {OUTFIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Outfit color ${c}`}
                  onClick={() => setAvatar({ ...avatar, outfitColor: c })}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-lg border-2 ${
                    avatar.outfitColor === c
                      ? 'border-slate-900 dark:border-amber-400 scale-110'
                      : 'border-transparent'
                  }`}
                />
              ))}
              <span className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
              {BG_GRADIENTS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-label={`Backdrop ${g}`}
                  onClick={() => setAvatar({ ...avatar, bgGradient: g })}
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${g} border-2 ${
                    avatar.bgGradient === g
                      ? 'border-slate-900 dark:border-amber-400 scale-110'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Status Note
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={140}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Private Room PIN Lock & Appearance */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Lock className="w-4 h-4 text-amber-500" />
            Private Room PIN Lock
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {pinEnabled
              ? 'PIN lock is active. Anyone without your GF invite link must enter this PIN.'
              : 'Optional: set a secret PIN so only you and your girlfriend can open this room.'}
          </p>
          {pinMessage && (
            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {pinMessage}
            </div>
          )}
          <form onSubmit={handlePinSubmit} className="flex items-center gap-2">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder={pinEnabled ? 'New PIN (4+ chars)' : 'Set secret PIN (4+ chars)'}
              minLength={4}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={pinInput.trim().length < 4}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 text-xs font-semibold disabled:opacity-50"
            >
              {pinEnabled ? 'Update' : 'Set PIN'}
            </button>
            {pinEnabled && (
              <button
                type="button"
                onClick={handleClearPin}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Remove
              </button>
            )}
          </form>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Theme & Data Export
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Switch light or dark theme or download a copy of your shared messages.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => darkMode && onToggleDarkMode()}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  !darkMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => !darkMode && onToggleDarkMode()}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  darkMode ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-600'
                }`}
              >
                Dark
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportMyData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Chat JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
