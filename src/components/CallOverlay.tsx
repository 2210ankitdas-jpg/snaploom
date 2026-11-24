import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
import type { ActiveCallSession, Conversation, UserProfile } from '../types';
import { AvatarView } from './AvatarView';

interface CallOverlayProps {
  call: ActiveCallSession;
  conversation: Conversation;
  currentUser: UserProfile;
  usersById: Record<string, UserProfile>;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  onToggleMic: (muted: boolean) => void;
  onToggleCam: (off: boolean) => void;
  onHangup: () => void;
}

export function CallOverlay({
  call,
  conversation,
  currentUser,
  usersById,
  remoteStream,
  localStream,
  onToggleMic,
  onToggleCam,
  onHangup,
}: CallOverlayProps) {
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(call.mode === 'audio');
  const [elapsedSec, setElapsedSec] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [call.startedAt]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  function formatDuration(totalSec: number): string {
    const mins = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  const otherParticipants = conversation.participantIds
    .filter((id) => id !== currentUser.id)
    .map((id) => usersById[id])
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between max-w-4xl w-full mx-auto">
        <div>
          <h2 className="text-lg font-bold">{conversation.name}</h2>
          <p className="text-xs text-slate-400">
            {call.mode === 'video' ? 'Video Call' : 'Voice Call'} ·{' '}
            <span className="font-mono">{formatDuration(elapsedSec)}</span>
          </p>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          {call.participantIds.length} active
        </div>
      </div>

      {/* Main Call Stage */}
      <div className="flex-1 flex items-center justify-center max-w-4xl w-full mx-auto my-6 relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800">
        {remoteStream && call.mode === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-8 p-8">
            {otherParticipants.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-3">
                <AvatarView avatar={p.avatar} size={104} alt={p.displayName} />
                <div className="text-sm font-semibold">{p.displayName}</div>
                <div className="text-xs text-slate-400">
                  {call.participantIds.includes(p.id) ? 'Connected' : 'Ringing...'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Self Preview Tile */}
        <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-[3/4] rounded-2xl overflow-hidden bg-slate-950 border border-slate-700 shadow-lg flex items-center justify-center">
          {localStream && !camOff ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <AvatarView avatar={currentUser.avatar} size={56} alt={currentUser.displayName} />
              <span className="text-[11px] text-slate-400">You</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center gap-4 pb-2">
        <button
          type="button"
          onClick={() => {
            const next = !micMuted;
            setMicMuted(next);
            onToggleMic(next);
          }}
          aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            micMuted ? 'bg-white text-slate-950' : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !camOff;
            setCamOff(next);
            onToggleCam(next);
          }}
          aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            camOff ? 'bg-white text-slate-950' : 'bg-slate-800 text-white hover:bg-slate-700'
          }`}
        >
          {camOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={onHangup}
          aria-label="End call"
          className="w-16 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
