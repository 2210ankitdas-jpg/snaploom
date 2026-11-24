import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Send, X } from 'lucide-react';
import type { StoryItem, UserProfile } from '../types';
import { AvatarView } from './AvatarView';

interface StoriesViewProps {
  stories: StoryItem[];
  usersById: Record<string, UserProfile>;
  currentUser: UserProfile;
  partner: UserProfile;
  onViewStory: (storyId: string) => void;
  onReplyToStory: (text: string) => Promise<void>;
  onOpenCamera: () => void;
}

export function StoriesView({
  stories,
  usersById,
  currentUser,
  partner,
  onViewStory,
  onReplyToStory,
  onOpenCamera,
}: StoriesViewProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);

  const activeStory = activeIndex !== null ? stories[activeIndex] : null;

  useEffect(() => {
    if (activeStory && !activeStory.viewedBy.includes(currentUser.id)) {
      onViewStory(activeStory.id);
    }
  }, [activeStory, currentUser.id, onViewStory]);

  function formatRemainingHours(expiresAt: number): string {
    const diff = Math.max(0, expiresAt - Date.now());
    const hrs = Math.ceil(diff / 3_600_000);
    return `${hrs}h left`;
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStory || !replyText.trim()) return;
    await onReplyToStory(`Replied to your story: "${replyText.trim()}"`);
    setReplyText('');
    setReplySent(true);
    setTimeout(() => setReplySent(false), 1800);
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Our Private Stories
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            24-hour moments visible only to you and {partner.displayName}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCamera}
          className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 transition-colors whitespace-nowrap min-h-[40px] self-start sm:self-auto"
        >
          Add Story
        </button>
      </div>

      {stories.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No active stories between the two of you right now.
          </p>
          <button
            type="button"
            onClick={onOpenCamera}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 text-xs font-semibold"
          >
            Share a Moment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stories.map((story, idx) => {
            const author = usersById[story.authorId];
            const isViewed = story.viewedBy.includes(currentUser.id);
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className="group relative aspect-[9/14] rounded-2xl overflow-hidden bg-slate-900 text-left border border-slate-200 dark:border-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <img
                  src={story.mediaUrl}
                  alt={story.caption || 'Story update'}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />

                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
                  {author && (
                    <div
                      className={`p-0.5 rounded-2xl ${
                        isViewed ? 'bg-white/30' : 'bg-amber-400'
                      }`}
                    >
                      <AvatarView avatar={author.avatar} size={36} alt={author.displayName} />
                    </div>
                  )}
                  <span className="font-mono text-[11px] text-white/90">
                    {formatRemainingHours(story.expiresAt)}
                  </span>
                </div>

                <div className="absolute bottom-3.5 left-3.5 right-3.5 space-y-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {author?.id === currentUser.id ? 'You' : partner.displayName}
                  </div>
                  {story.caption && (
                    <p className="text-xs text-white/85 line-clamp-2">{story.caption}</p>
                  )}
                  <div className="text-[11px] text-white/70 flex items-center gap-1.5 pt-0.5">
                    <span>{story.lensName || 'Natural'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">
                      {story.viewedBy.includes(partner.id) ? `Seen by ${partner.displayName}` : 'Unseen'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeStory && activeIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
          <div className="relative w-full max-w-[420px] aspect-[9/16] max-h-[90vh] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
            <img
              src={activeStory.mediaUrl}
              alt={activeStory.caption || 'Story'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/65" />

            <div className="absolute top-3 left-3 right-3 flex gap-1.5">
              {stories.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-1 flex-1 rounded-full ${
                    i <= activeIndex ? 'bg-amber-400' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <div className="absolute top-7 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {usersById[activeStory.authorId] && (
                  <AvatarView
                    avatar={usersById[activeStory.authorId].avatar}
                    size={36}
                    alt={usersById[activeStory.authorId].displayName}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {activeStory.authorId === currentUser.id ? 'You' : partner.displayName}
                  </div>
                  <div className="text-[11px] text-white/75 flex items-center gap-1.5">
                    <span>{activeStory.lensName || 'Natural'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatRemainingHours(activeStory.expiresAt)}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveIndex(null)}
                aria-label="Close story"
                className="p-2 rounded-full bg-black/50 text-white hover:bg-black/80 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeIndex > 0 && (
              <button
                type="button"
                onClick={() => setActiveIndex(activeIndex - 1)}
                aria-label="Previous story"
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {activeIndex < stories.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveIndex(activeIndex + 1)}
                aria-label="Next story"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            <div className="absolute bottom-4 left-4 right-4 space-y-3">
              {activeStory.caption && (
                <p className="text-sm text-white font-medium">{activeStory.caption}</p>
              )}

              <div className="flex items-center gap-1.5 text-xs text-white/75 font-mono">
                <Eye className="w-3.5 h-3.5" />
                <span>{activeStory.viewedBy.length} of 2 viewed</span>
              </div>

              {activeStory.authorId !== currentUser.id && (
                <form onSubmit={handleSendReply} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={replySent ? 'Sent to chat' : `Reply to ${partner.displayName}...`}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/65 border border-white/25 text-white text-xs placeholder:text-white/60 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    aria-label="Send reply"
                    className="p-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 min-h-[40px] min-w-[40px] flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
