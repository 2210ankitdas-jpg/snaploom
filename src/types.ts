export type HairStyle = 'short' | 'wavy' | 'curls' | 'bob' | 'buzz' | 'bun';
export type EyewearStyle = 'none' | 'round' | 'shades' | 'square';
export type AccessoryStyle = 'none' | 'cap' | 'beanie' | 'headphones' | 'halo';
export type MoodStyle = 'smile' | 'grin' | 'chill' | 'wink';

export interface AvatarConfig {
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  eyewear: EyewearStyle;
  outfitColor: string;
  accessory: AccessoryStyle;
  bgGradient: string;
  mood: MoodStyle;
}

export interface UserProfile {
  id: string;
  partnerRole: 'you' | 'gf';
  handle: string;
  displayName: string;
  bio: string;
  avatar: AvatarConfig;
  streakCount: number;
  online: boolean;
  lastActiveAt: number;
}

export type MessageKind = 'text' | 'snap' | 'voice' | 'system';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  mediaUrl?: string;
  lensName?: string;
  durationSec?: number;
  ttlSeconds: number;
  createdAt: number;
  expiresAt?: number | null;
  viewedBy: string[];
  reactions: Record<string, string[]>;
}

export interface Conversation {
  id: string;
  type: 'direct';
  name: string;
  participantIds: string[];
  createdAt: number;
  updatedAt: number;
  lastMessagePreview: string;
  ephemeralDefaultSec: number;
}

export interface StoryItem {
  id: string;
  authorId: string;
  mediaUrl: string;
  caption: string;
  lensName?: string;
  audience: 'us';
  createdAt: number;
  expiresAt: number;
  viewedBy: string[];
}

export interface ActiveCallSession {
  callId: string;
  conversationId: string;
  initiatorId: string;
  mode: 'audio' | 'video';
  participantIds: string[];
  startedAt: number;
}

export interface BootstrapPayload {
  currentUser: UserProfile | null;
  partner: UserProfile | null;
  users: UserProfile[];
  conversation: Conversation | null;
  messages: ChatMessage[];
  stories: StoryItem[];
  activeCalls: ActiveCallSession[];
  inviteKey?: string;
  pinEnabled: boolean;
}

export type WsClientEvent =
  | { type: 'auth:identify'; token: string }
  | { type: 'chat:typing'; conversationId: string; isTyping: boolean }
  | {
      type: 'call:signal';
      targetUserId: string;
      conversationId: string;
      signalType: 'offer' | 'answer' | 'ice' | 'hangup' | 'invite' | 'accept' | 'decline';
      mode?: 'audio' | 'video';
      payload?: unknown;
    };

export type WsServerEvent =
  | { type: 'presence:update'; userId: string; online: boolean; lastActiveAt: number }
  | { type: 'user:updated'; user: UserProfile }
  | { type: 'message:created'; message: ChatMessage }
  | { type: 'message:updated'; message: ChatMessage }
  | { type: 'message:expired'; conversationId: string; messageId: string }
  | { type: 'chat:typing'; conversationId: string; userId: string; isTyping: boolean }
  | { type: 'story:created'; story: StoryItem }
  | { type: 'story:updated'; story: StoryItem }
  | { type: 'story:expired'; storyId: string }
  | { type: 'call:state'; calls: ActiveCallSession[] }
  | {
      type: 'call:signal';
      fromUserId: string;
      conversationId: string;
      signalType: 'offer' | 'answer' | 'ice' | 'hangup' | 'invite' | 'accept' | 'decline';
      mode?: 'audio' | 'video';
      payload?: unknown;
    };
