import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Clock,
  Heart,
  Link2,
  Mic,
  Phone,
  Send,
  Video,
  X,
} from 'lucide-react';
import type { ChatMessage, UserProfile } from '../types';
import { AvatarView } from './AvatarView';

interface ChatWorkspaceProps {
  roomName: string;
  currentUser: UserProfile;
  partner: UserProfile;
  messages: ChatMessage[];
  partnerTyping: boolean;
  onSendMessage: (payload: {
    kind: 'text' | 'voice';
    text: string;
    ttlSeconds: number;
    durationSec?: number;
  }) => Promise<void>;
  onViewMessage: (messageId: string) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onTypingChange: (isTyping: boolean) => void;
  onStartCall: (mode: 'audio' | 'video') => void;
  onOpenCamera: () => void;
  onOpenInvite: () => void;
}

const REACTION_EMOJIS = ['❤️', '😘', '🔥', '😂'];

export function ChatWorkspace({
  roomName,
  currentUser,
  partner,
  messages,
  partnerTyping,
  onSendMessage,
  onViewMessage,
  onReactMessage,
  onTypingChange,
  onStartCall,
  onOpenCamera,
  onOpenInvite,
}: ChatWorkspaceProps) {
  const [text, setText] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState<number>(86400);
  const [openSnap, setOpenSnap] = useState<ChatMessage | null>(null);
  const [snapCountdown, setSnapCountdown] = useState<number>(10);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceStartMs, setVoiceStartMs] = useState<number>(0);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, partnerTyping]);

  useEffect(() => {
    if (!openSnap || openSnap.ttlSeconds !== 10) return;
    setSnapCountdown(10);
    const id = setInterval(() => {
      setSnapCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setOpenSnap(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [openSnap]);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatLastSeen(ts: number): string {
    const mins = Math.floor((Date.now() - ts) / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  function handleTextChange(val: string) {
    setText(val);
    onTypingChange(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingChange(false);
    }, 1400);
  }

  async function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const toSend = text.trim();
    setText('');
    onTypingChange(false);
    await onSendMessage({
      kind: 'text',
      text: toSend,
      ttlSeconds,
    });
  }

  async function handleVoiceToggle() {
    if (!recordingVoice) {
      setRecordingVoice(true);
      setVoiceStartMs(Date.now());
    } else {
      setRecordingVoice(false);
      const durationSec = Math.max(2, Math.min(30, Math.round((Date.now() - voiceStartMs) / 1000)));
      await onSendMessage({
        kind: 'voice',
        text: `Voice note (${durationSec}s)`,
        ttlSeconds,
        durationSec,
      });
    }
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Desktop Partner Info Rail */}
      <aside className="hidden md:flex w-80 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shrink-0">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-3 pt-2">
            <AvatarView avatar={partner.avatar} size={88} alt={partner.displayName} />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {partner.displayName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {partner.online
                  ? 'Online right now'
                  : `Last active ${formatLastSeen(partner.lastActiveAt)}`}
              </p>
            </div>
            {partner.bio && (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-[220px]">
                {partner.bio}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-900 space-y-2.5">
            <button
              type="button"
              onClick={() => onStartCall('video')}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm hover:bg-amber-300 transition-colors min-h-[44px]"
            >
              <Video className="w-4 h-4" />
              Video Call {partner.displayName}
            </button>
            <button
              type="button"
              onClick={() => onStartCall('audio')}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors min-h-[44px]"
            >
              <Phone className="w-4 h-4" />
              Voice Call
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-900 space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Private Space</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">Only You Two</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shared Streak</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                {partner.streakCount} days
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenInvite}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors min-h-[42px]"
        >
          <Link2 className="w-3.5 h-3.5" />
          Share Private Invite Link
        </button>
      </aside>

      {/* Main Real-Time Chat Stage */}
      <section className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-w-0">
        {/* Thread Header */}
        <div className="px-4 md:px-6 py-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarView avatar={partner.avatar} size={40} alt={partner.displayName} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {roomName}
                </h3>
                <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {partnerTyping
                  ? `${partner.displayName} is typing...`
                  : partner.online
                    ? `${partner.displayName} online now`
                    : `${partner.displayName} · Last seen ${formatLastSeen(partner.lastActiveAt)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onStartCall('audio')}
              aria-label="Start voice call"
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onStartCall('video')}
              aria-label="Start video call"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 transition-colors min-h-[40px]"
            >
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">Video Call</span>
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((msg) => {
            if (msg.kind === 'system') {
              return (
                <div
                  key={msg.id}
                  className="max-w-lg mx-auto text-center px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed"
                >
                  {msg.text}
                </div>
              );
            }

            const isMine = msg.senderId === currentUser.id;
            const sender = isMine ? currentUser : partner;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <AvatarView avatar={sender.avatar} size={32} alt={sender.displayName} />
                <div
                  className={`max-w-[78%] sm:max-w-md space-y-1 flex flex-col ${
                    isMine ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {isMine ? 'You' : partner.displayName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatTime(msg.createdAt)}</span>
                    {msg.ttlSeconds > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">
                          {msg.ttlSeconds === 10 ? '10s' : '24h'}
                        </span>
                      </>
                    )}
                  </div>

                  {msg.kind === 'snap' && msg.mediaUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSnap(msg);
                        onViewMessage(msg.id);
                      }}
                      className="group relative w-52 aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 text-left"
                    >
                      <img
                        src={msg.mediaUrl}
                        alt={msg.text || 'Snap'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <div className="text-xs font-semibold truncate">
                          {msg.text || 'Tap to view snap'}
                        </div>
                        <div className="text-[11px] text-white/75 font-mono">
                          {msg.lensName || 'Snap'} · Tap to open
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMine
                          ? 'bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {msg.kind === 'voice' ? (
                        <div className="flex items-center gap-2.5">
                          <Mic className="w-4 h-4 shrink-0" />
                          <span className="font-mono text-xs">{msg.text}</span>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  )}

                  {/* Reactions */}
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {Object.entries(msg.reactions).map(([emoji, uids]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onReactMessage(msg.id, emoji)}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      >
                        {emoji} {uids.length}
                      </button>
                    ))}
                    <div className="opacity-60 hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onReactMessage(msg.id, emoji)}
                          className="p-1 text-xs hover:scale-110 transition-transform"
                          aria-label={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={threadEndRef} />
        </div>

        {/* Typing Indicator */}
        {partnerTyping && (
          <div className="px-6 py-1.5 text-xs text-slate-500 dark:text-slate-400">
            {partner.displayName} is typing...
          </div>
        )}

        {/* Composer Bar */}
        <form
          onSubmit={handleSendText}
          className="p-3 md:p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={onOpenCamera}
            aria-label="Open camera to send snap"
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-amber-400 hover:text-slate-950 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleVoiceToggle}
            aria-label="Record voice note"
            className={`p-2.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 ${
              recordingVoice
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Mic className="w-4 h-4" />
          </button>

          <select
            aria-label="Message expiration timer"
            value={ttlSeconds}
            onChange={(e) => setTtlSeconds(Number(e.target.value))}
            className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300 border border-transparent focus:border-slate-300 min-h-[44px] shrink-0"
          >
            <option value={86400}>24h</option>
            <option value={10}>10s</option>
            <option value={0}>Keep</option>
          </select>

          <input
            type="text"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={
              recordingVoice
                ? 'Recording voice note — tap mic to send...'
                : `Message ${partner.displayName}...`
            }
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[44px]"
          />

          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Send message"
            className="p-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 disabled:opacity-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>

      {/* Timed Snap Viewer */}
      {openSnap && openSnap.mediaUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
          <div className="relative w-full max-w-[400px] aspect-[3/4] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
            <img
              src={openSnap.mediaUrl}
              alt={openSnap.text || 'Timed snap'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50" />
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-white font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {openSnap.ttlSeconds === 10
                    ? `Expires in ${snapCountdown}s`
                    : openSnap.ttlSeconds === 86400
                      ? '24h Snap'
                      : 'Saved Snap'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenSnap(null)}
                aria-label="Close snap"
                className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {openSnap.text && (
              <div className="absolute bottom-6 left-4 right-4 text-center text-white text-sm font-semibold">
                {openSnap.text}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
