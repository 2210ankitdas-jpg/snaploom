import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Compass, Heart, MessageSquare, User } from 'lucide-react';
import type {
  ActiveCallSession,
  AvatarConfig,
  BootstrapPayload,
  ChatMessage,
  Conversation,
  StoryItem,
  UserProfile,
  WsServerEvent,
} from './types';
import { CameraLensStudio } from './components/CameraLensStudio';
import { ChatWorkspace } from './components/ChatWorkspace';
import { StoriesView } from './components/StoriesView';
import { AvatarStudio } from './components/AvatarStudio';
import { AuthModal } from './components/AuthModal';
import { DownloadModal } from './components/DownloadModal';
import { CallOverlay } from './components/CallOverlay';

type AppTab = 'camera' | 'chats' | 'stories' | 'profile';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('chats');
  const [darkMode, setDarkMode] = useState(false);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCallSession[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [inviteKey, setInviteKey] = useState<string | undefined>(undefined);
  const [pinEnabled, setPinEnabled] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const [currentCall, setCurrentCall] = useState<ActiveCallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentCallRef = useRef<ActiveCallSession | null>(null);
  const currentUserRef = useRef<UserProfile | null>(null);

  currentCallRef.current = currentCall;
  currentUserRef.current = currentUser;

  const usersById = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    for (const u of users) map[u.id] = u;
    if (currentUser) map[currentUser.id] = currentUser;
    if (partner) map[partner.id] = partner;
    return map;
  }, [users, currentUser, partner]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const loadBootstrap = useCallback(async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/bootstrap', { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as BootstrapPayload;
    setUsers(data.users);
    setConversation(data.conversation);
    setMessages(data.messages);
    setStories(data.stories);
    setActiveCalls(data.activeCalls);
    setInviteKey(data.inviteKey);
    setPinEnabled(data.pinEnabled);
    if (data.currentUser) setCurrentUser(data.currentUser);
    if (data.partner) setPartner(data.partner);
    return data;
  }, []);

  // Initial load: check GF invite link or auto-enter if no PIN lock is active
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const role = params.get('partner') === 'gf' ? 'gf' : 'you';
        const invite = params.get('invite') || undefined;

        const enterRes = await fetch('/api/auth/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, inviteKey: invite }),
        });

        if (enterRes.ok && mounted) {
          const authData = (await enterRes.json()) as { token: string; user: UserProfile };
          if (invite) {
            window.history.replaceState({}, '', '/');
          }
          setAuthToken(authData.token);
          setCurrentUser(authData.user);
          await loadBootstrap(authData.token);
        } else if (mounted) {
          await loadBootstrap(null);
          setShowAuthModal(true);
        }
      } finally {
        if (mounted) setBootstrapping(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadBootstrap]);

  const cleanupMediaAndPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: string, conversationId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'call:signal',
              targetUserId,
              conversationId,
              signalType: 'ice',
              payload: event.candidate,
            })
          );
        }
      };

      peerRef.current = pc;
      return pc;
    },
    []
  );

  // Real-time WebSocket connection
  useEffect(() => {
    if (!authToken) return;
    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    let isFirstConnect = true;
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth:identify', token: authToken }));
        if (!isFirstConnect) {
          void loadBootstrap(authToken);
        }
        isFirstConnect = false;
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsServerEvent;

          if (msg.type === 'presence:update') {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === msg.userId
                  ? { ...u, online: msg.online, lastActiveAt: msg.lastActiveAt }
                  : u
              )
            );
            setPartner((prev) =>
              prev && prev.id === msg.userId
                ? { ...prev, online: msg.online, lastActiveAt: msg.lastActiveAt }
                : prev
            );
          } else if (msg.type === 'user:updated') {
            setUsers((prev) => prev.map((u) => (u.id === msg.user.id ? msg.user : u)));
            if (currentUserRef.current?.id === msg.user.id) {
              setCurrentUser(msg.user);
            } else {
              setPartner(msg.user);
            }
          } else if (msg.type === 'message:created') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.message.id)) return prev;
              return [...prev, msg.message];
            });
          } else if (msg.type === 'message:updated') {
            setMessages((prev) =>
              prev.map((m) => (m.id === msg.message.id ? msg.message : m))
            );
          } else if (msg.type === 'message:expired') {
            setMessages((prev) => prev.filter((m) => m.id !== msg.messageId));
          } else if (msg.type === 'chat:typing') {
            if (msg.userId !== currentUserRef.current?.id) {
              setPartnerTyping(msg.isTyping);
            }
          } else if (msg.type === 'story:created') {
            setStories((prev) => {
              if (prev.some((s) => s.id === msg.story.id)) return prev;
              return [msg.story, ...prev];
            });
          } else if (msg.type === 'story:updated') {
            setStories((prev) => prev.map((s) => (s.id === msg.story.id ? msg.story : s)));
          } else if (msg.type === 'story:expired') {
            setStories((prev) => prev.filter((s) => s.id !== msg.storyId));
          } else if (msg.type === 'call:state') {
            setActiveCalls(msg.calls);
            if (currentCallRef.current) {
              const updated = msg.calls.find((c) => c.callId === currentCallRef.current?.callId);
              if (updated) {
                setCurrentCall(updated);
              }
            }
          } else if (msg.type === 'call:signal') {
            if (msg.signalType === 'offer' && msg.payload) {
              const pc =
                peerRef.current || createPeerConnection(msg.fromUserId, msg.conversationId);
              await pc.setRemoteDescription(
                new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit)
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(
                JSON.stringify({
                  type: 'call:signal',
                  targetUserId: msg.fromUserId,
                  conversationId: msg.conversationId,
                  signalType: 'answer',
                  payload: answer,
                })
              );
            } else if (msg.signalType === 'answer' && msg.payload && peerRef.current) {
              await peerRef.current.setRemoteDescription(
                new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit)
              );
            } else if (msg.signalType === 'ice' && msg.payload && peerRef.current) {
              await peerRef.current.addIceCandidate(
                new RTCIceCandidate(msg.payload as RTCIceCandidateInit)
              );
            } else if (msg.signalType === 'hangup') {
              cleanupMediaAndPeer();
              setCurrentCall(null);
            }
          }
        } catch {
          // Ignore malformed WS events
        }
      };

      ws.onclose = () => {
        if (!closedByCleanup) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();
    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [authToken, cleanupMediaAndPeer, createPeerConnection, loadBootstrap]);

  async function handleAuthSuccess(token: string, user: UserProfile) {
    setAuthToken(token);
    setCurrentUser(user);
    setShowAuthModal(false);
    await loadBootstrap(token);
  }

  function handleLogout() {
    cleanupMediaAndPeer();
    setCurrentCall(null);
    setAuthToken(null);
    setCurrentUser(null);
    setMessages([]);
    setShowAuthModal(true);
  }

  async function handleSaveProfile(payload: {
    displayName: string;
    bio: string;
    avatar: AvatarConfig;
  }) {
    if (!authToken) return;
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: UserProfile };
      setCurrentUser(data.user);
    }
  }

  async function handleUpdatePin(pin: string | null) {
    if (!authToken) return;
    const res = await fetch('/api/couple/pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      const data = (await res.json()) as { pinEnabled: boolean };
      setPinEnabled(data.pinEnabled);
    }
  }

  async function handleRotateInviteKey() {
    if (!authToken) return;
    const res = await fetch('/api/couple/rotate-invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { inviteKey: string };
      setInviteKey(data.inviteKey);
    }
  }

  async function handleSendMessage(payload: {
    kind: 'text' | 'voice';
    text: string;
    ttlSeconds: number;
    durationSec?: number;
  }) {
    if (!authToken) return;
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
    }
  }

  async function handleSendSnap(payload: {
    mediaUrl: string;
    caption: string;
    lensName: string;
    ttlSeconds: number;
  }) {
    if (!authToken) return;
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        kind: 'snap',
        text: payload.caption,
        mediaUrl: payload.mediaUrl,
        lensName: payload.lensName,
        ttlSeconds: payload.ttlSeconds,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
    }
  }

  async function handlePostStory(payload: {
    mediaUrl: string;
    caption: string;
    lensName: string;
  }) {
    if (!authToken) return;
    await fetch('/api/stories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
  }

  const handleViewStory = useCallback(
    async (storyId: string) => {
      if (!authToken) return;
      await fetch(`/api/stories/${storyId}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
    [authToken]
  );

  async function handleReplyToStory(text: string) {
    await handleSendMessage({ kind: 'text', text, ttlSeconds: 86400 });
  }

  async function handleViewMessage(messageId: string) {
    if (!authToken) return;
    await fetch(`/api/messages/${messageId}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
  }

  async function handleReactMessage(messageId: string, emoji: string) {
    if (!authToken) return;
    await fetch(`/api/messages/${messageId}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ emoji }),
    });
  }

  function handleTypingChange(isTyping: boolean) {
    if (wsRef.current?.readyState === WebSocket.OPEN && conversation) {
      wsRef.current.send(
        JSON.stringify({ type: 'chat:typing', conversationId: conversation.id, isTyping })
      );
    }
  }

  async function handleStartCall(mode: 'audio' | 'video') {
    if (!authToken || !currentUser || !partner || !conversation) return;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === 'video',
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
    } catch {
      // Proceed even if hardware camera/mic is unavailable
    }

    const res = await fetch('/api/calls/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ mode }),
    });

    if (res.ok) {
      const data = (await res.json()) as { call: ActiveCallSession };
      setCurrentCall(data.call);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pc = createPeerConnection(partner.id, conversation.id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current.send(
          JSON.stringify({
            type: 'call:signal',
            targetUserId: partner.id,
            conversationId: conversation.id,
            signalType: 'offer',
            mode,
            payload: offer,
          })
        );
      }
    }
  }

  async function handleHangup() {
    if (currentCall && authToken && partner && conversation) {
      await fetch('/api/calls/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ callId: currentCall.callId }),
      });

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'call:signal',
            targetUserId: partner.id,
            conversationId: conversation.id,
            signalType: 'hangup',
          })
        );
      }
    }
    cleanupMediaAndPeer();
    setCurrentCall(null);
  }

  function handleToggleMic(muted: boolean) {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  function handleToggleCam(off: boolean) {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !off;
    });
  }

  async function handleInstallPwa() {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
  }

  const incomingCallBanner = activeCalls.find(
    (c) => c.callId !== currentCall?.callId && !c.participantIds.includes(currentUser?.id || '')
  );

  return (
    <div className="h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Three-Zone Top Navigation Bar */}
      <header className="h-16 px-4 md:px-8 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-8 shrink-0 z-30">
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 font-display"
        >
          SnapLoom
        </button>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          {(
            [
              { id: 'chats', label: 'Just Us' },
              { id: 'camera', label: 'Camera' },
              { id: 'stories', label: 'Our Stories' },
              { id: 'profile', label: 'Profile' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? 'border-amber-400 text-slate-900 dark:text-slate-100 font-semibold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setShowDownloadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <Heart className="w-3.5 h-3.5" />
            Invite GF
          </button>
        </div>
      </header>

      {/* Incoming Call Ringing Banner */}
      {incomingCallBanner && partner && (
        <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="text-xs font-medium">
            {partner.displayName} is calling ({incomingCallBanner.mode})
          </div>
          <button
            type="button"
            onClick={() => handleStartCall(incomingCallBanner.mode)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300"
          >
            Answer Call
          </button>
        </div>
      )}

      {/* Main Content Stage */}
      <main className="flex-1 min-h-0 pb-16 md:pb-0">
        {bootstrapping ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">
            Connecting private room...
          </div>
        ) : !currentUser || !partner || !authToken ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Private Space for Two
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Unlock your private real-time chat, camera snaps, and voice/video calls.
            </p>
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-semibold text-sm hover:bg-amber-300 min-h-[44px]"
            >
              Enter Room
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'chats' && (
              <ChatWorkspace
                roomName={conversation?.name || 'Ankit and Sarmistha Spicy Room'}
                currentUser={currentUser}
                partner={partner}
                messages={messages}
                partnerTyping={partnerTyping}
                onSendMessage={handleSendMessage}
                onViewMessage={handleViewMessage}
                onReactMessage={handleReactMessage}
                onTypingChange={handleTypingChange}
                onStartCall={handleStartCall}
                onOpenCamera={() => setActiveTab('camera')}
                onOpenInvite={() => setShowDownloadModal(true)}
              />
            )}

            {activeTab === 'camera' && (
              <CameraLensStudio
                partner={partner}
                onSendSnap={handleSendSnap}
                onPostStory={handlePostStory}
              />
            )}

            {activeTab === 'stories' && (
              <StoriesView
                stories={stories}
                usersById={usersById}
                currentUser={currentUser}
                partner={partner}
                onViewStory={handleViewStory}
                onReplyToStory={handleReplyToStory}
                onOpenCamera={() => setActiveTab('camera')}
              />
            )}

            {activeTab === 'profile' && (
              <AvatarStudio
                user={currentUser}
                authToken={authToken}
                darkMode={darkMode}
                pinEnabled={pinEnabled}
                onToggleDarkMode={() => setDarkMode((d) => !d)}
                onSaveProfile={handleSaveProfile}
                onUpdatePin={handleUpdatePin}
                onSwitchAccount={() => setShowAuthModal(true)}
                onLogout={handleLogout}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center z-40"
      >
        {(
          [
            { id: 'chats', label: 'Just Us', Icon: MessageSquare },
            { id: 'camera', label: 'Camera', Icon: Camera },
            { id: 'stories', label: 'Stories', Icon: Compass },
            { id: 'profile', label: 'Profile', Icon: User },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center min-h-[48px] transition-colors ${
                active
                  ? 'text-slate-900 dark:text-amber-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] mt-0.5">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Call Overlay */}
      {currentCall && currentUser && conversation && (
        <CallOverlay
          call={currentCall}
          conversation={conversation}
          currentUser={currentUser}
          usersById={usersById}
          remoteStream={remoteStream}
          localStream={localStream}
          onToggleMic={handleToggleMic}
          onToggleCam={handleToggleCam}
          onHangup={handleHangup}
        />
      )}

      {/* Partner Switcher / PIN Modal */}
      <AuthModal
        open={showAuthModal}
        onClose={currentUser ? () => setShowAuthModal(false) : undefined}
        partners={users}
        pinEnabled={pinEnabled}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Invite GF + Download App Modal */}
      <DownloadModal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        inviteKey={inviteKey}
        onRotateInviteKey={handleRotateInviteKey}
        canInstallPwa={Boolean(deferredInstallPrompt)}
        onInstallPwa={handleInstallPwa}
      />
    </div>
  );
}
