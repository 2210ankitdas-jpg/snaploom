import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Archiver, ArchiverOptions } from 'archiver';
import type {
  ActiveCallSession,
  AvatarConfig,
  ChatMessage,
  Conversation,
  StoryItem,
  UserProfile,
  WsClientEvent,
  WsServerEvent,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'snaploom-couple.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const CONVERSATION_ID = 'conv_us';
const PARTNER_YOU_ID = 'partner_you';
const PARTNER_GF_ID = 'partner_gf';

interface CoupleStoreData {
  inviteKey: string;
  pinHash?: string;
  pinSalt?: string;
  users: UserProfile[];
  conversation: Conversation;
  messages: ChatMessage[];
  stories: StoryItem[];
}

function nowMs(): number {
  return Date.now();
}

function createDefaultStore(): CoupleStoreData {
  const t = nowMs();
  const users: UserProfile[] = [
    {
      id: PARTNER_YOU_ID,
      partnerRole: 'you',
      handle: 'ankit',
      displayName: 'Ankit',
      bio: 'Just the two of us.',
      streakCount: 14,
      online: false,
      lastActiveAt: t,
      avatar: {
        skinTone: '#D99B72',
        hairStyle: 'short',
        hairColor: '#1E293B',
        eyewear: 'none',
        outfitColor: '#0F172A',
        accessory: 'none',
        bgGradient: 'from-sky-200 to-indigo-200',
        mood: 'smile',
      },
    },
    {
      id: PARTNER_GF_ID,
      partnerRole: 'gf',
      handle: 'sarmistha',
      displayName: 'Sarmistha',
      bio: 'Private room for us.',
      streakCount: 14,
      online: false,
      lastActiveAt: t - 60_000,
      avatar: {
        skinTone: '#F2C9AC',
        hairStyle: 'wavy',
        hairColor: '#1E293B',
        eyewear: 'round',
        outfitColor: '#E11D48',
        accessory: 'halo',
        bgGradient: 'from-rose-200 to-amber-100',
        mood: 'wink',
      },
    },
  ];

  const conversation: Conversation = {
    id: CONVERSATION_ID,
    type: 'direct',
    name: 'Ankit and Sarmistha Spicy Room',
    participantIds: [PARTNER_YOU_ID, PARTNER_GF_ID],
    createdAt: t,
    updatedAt: t,
    lastMessagePreview: 'Private space ready for you two',
    ephemeralDefaultSec: 0,
  };

  const messages: ChatMessage[] = [
    {
      id: 'msg_welcome',
      conversationId: CONVERSATION_ID,
      senderId: PARTNER_GF_ID,
      kind: 'system',
      text: 'This room is strictly private between the two of you. Share your Invite Link with your girlfriend so both of you can chat, snap, and call live.',
      ttlSeconds: 0,
      createdAt: t - 30_000,
      expiresAt: null,
      viewedBy: [PARTNER_YOU_ID, PARTNER_GF_ID],
      reactions: {},
    },
  ];

  const stories: StoryItem[] = [
    {
      id: 'story_us_1',
      authorId: PARTNER_GF_ID,
      mediaUrl: '/src/assets/images/story_golden_hour_1795511540973.jpg',
      caption: 'Golden hour walk together',
      lensName: 'Golden Hour',
      audience: 'us',
      createdAt: t - 1_800_000,
      expiresAt: t + 84_600_000,
      viewedBy: [PARTNER_GF_ID],
    },
  ];

  return {
    inviteKey: crypto.randomBytes(12).toString('base64url'),
    users,
    conversation,
    messages,
    stories,
  };
}

function loadStore(): CoupleStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as CoupleStoreData;
      if (
        typeof parsed.inviteKey === 'string' &&
        Array.isArray(parsed.users) &&
        parsed.users.length === 2 &&
        parsed.conversation
      ) {
        let migrated = false;
        if (parsed.conversation.name === 'Just Us') {
          parsed.conversation.name = 'Ankit and Sarmistha Spicy Room';
          migrated = true;
        }
        const you = parsed.users.find((u) => u.id === PARTNER_YOU_ID);
        if (you && you.displayName === 'You') {
          you.displayName = 'Ankit';
          you.handle = 'ankit';
          migrated = true;
        }
        const gf = parsed.users.find((u) => u.id === PARTNER_GF_ID);
        if (gf && gf.displayName === 'My GF') {
          gf.displayName = 'Sarmistha';
          gf.handle = 'sarmistha';
          migrated = true;
        }
        if (migrated) saveStoreSync(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Initializing fresh private couple store:', err);
  }
  const initial = createDefaultStore();
  saveStoreSync(initial);
  return initial;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveStoreSync(data: CoupleStoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

function scheduleSave(data: CoupleStoreData): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveStoreSync(data);
  }, 200);
}

const store: CoupleStoreData = loadStore();
const activeCalls = new Map<string, ActiveCallSession>();

function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: nowMs(), exp: nowMs() + 14 * 86_400_000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: string;
      exp: number;
    };
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < nowMs()) {
      return null;
    }
    if (parsed.uid !== PARTNER_YOU_ID && parsed.uid !== PARTNER_GF_ID) {
      return null;
    }
    return parsed.uid;
  } catch {
    return null;
  }
}

function hashPin(pin: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, usedSalt, 64).toString('hex');
  return { hash, salt: usedSalt };
}

function verifyPin(pin: string, storedHash: string, salt: string): boolean {
  const computed = crypto.scryptSync(pin, salt, 64);
  const target = Buffer.from(storedHash, 'hex');
  if (computed.length !== target.length) return false;
  return crypto.timingSafeEqual(computed, target);
}

function isSafeMediaUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('/src/assets/images/') && !url.includes('..')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return true;
  return false;
}

interface AuthedRequest extends Request {
  userId?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const uid = verifySessionToken(token);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  req.userId = uid;
  next();
}

const VALID_HAIR_STYLES = new Set(['short', 'wavy', 'curls', 'bob', 'buzz', 'bun']);
const VALID_EYEWEAR = new Set(['none', 'round', 'shades', 'square']);
const VALID_ACCESSORY = new Set(['none', 'cap', 'beanie', 'headphones', 'halo']);
const VALID_MOOD = new Set(['smile', 'grin', 'chill', 'wink']);

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clientSockets = new Map<WebSocket, { userId: string | null; alive: boolean }>();

  function broadcast(event: WsServerEvent, targetUserIds?: string[]): void {
    const serialized = JSON.stringify(event);
    for (const [ws, meta] of clientSockets.entries()) {
      if (ws.readyState !== 1) continue;
      if (!meta.userId) continue;
      if (targetUserIds && !targetUserIds.includes(meta.userId)) continue;
      ws.send(serialized);
    }
  }

  function updateOnlineState(userId: string): void {
    const user = store.users.find((u) => u.id === userId);
    if (!user) return;
    const isConnected = Array.from(clientSockets.values()).some((m) => m.userId === userId);
    user.online = isConnected;
    user.lastActiveAt = nowMs();
    broadcast({
      type: 'presence:update',
      userId,
      online: user.online,
      lastActiveAt: user.lastActiveAt,
    });
  }

  // Keep-alive heartbeat every 20s for Cloud Run / proxy WebSocket stability
  setInterval(() => {
    for (const [ws, meta] of clientSockets.entries()) {
      if (!meta.alive) {
        ws.terminate();
        continue;
      }
      meta.alive = false;
      ws.ping();
    }
  }, 20_000);

  wss.on('connection', (ws) => {
    clientSockets.set(ws, { userId: null, alive: true });
    ws.on('pong', () => {
      const meta = clientSockets.get(ws);
      if (meta) meta.alive = true;
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientEvent;
        const meta = clientSockets.get(ws);
        if (!meta) return;

        if (msg.type === 'auth:identify') {
          const uid = verifySessionToken(msg.token);
          if (uid) {
            meta.userId = uid;
            updateOnlineState(uid);
          }
          return;
        }

        if (!meta.userId) return;

        if (msg.type === 'chat:typing') {
          if (msg.conversationId !== CONVERSATION_ID) return;
          const partnerId = meta.userId === PARTNER_YOU_ID ? PARTNER_GF_ID : PARTNER_YOU_ID;
          broadcast(
            {
              type: 'chat:typing',
              conversationId: CONVERSATION_ID,
              userId: meta.userId,
              isTyping: Boolean(msg.isTyping),
            },
            [partnerId]
          );
          return;
        }

        if (msg.type === 'call:signal') {
          if (msg.conversationId !== CONVERSATION_ID) return;
          const partnerId = meta.userId === PARTNER_YOU_ID ? PARTNER_GF_ID : PARTNER_YOU_ID;
          if (msg.targetUserId !== partnerId) return;

          broadcast(
            {
              type: 'call:signal',
              fromUserId: meta.userId,
              conversationId: CONVERSATION_ID,
              signalType: msg.signalType,
              mode: msg.mode,
              payload: msg.payload,
            },
            [partnerId]
          );
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => {
      const meta = clientSockets.get(ws);
      clientSockets.delete(ws);
      if (meta?.userId) {
        updateOnlineState(meta.userId);
      }
    });
  });

  // Periodic expiration sweep for ephemeral snaps/messages and 24-hour stories
  setInterval(() => {
    const t = nowMs();
    let changed = false;

    const expiredMsgs = store.messages.filter(
      (m) => typeof m.expiresAt === 'number' && m.expiresAt <= t
    );
    if (expiredMsgs.length > 0) {
      store.messages = store.messages.filter(
        (m) => !(typeof m.expiresAt === 'number' && m.expiresAt <= t)
      );
      changed = true;
      for (const m of expiredMsgs) {
        broadcast({ type: 'message:expired', conversationId: CONVERSATION_ID, messageId: m.id });
      }
    }

    const expiredStories = store.stories.filter((s) => s.expiresAt <= t);
    if (expiredStories.length > 0) {
      store.stories = store.stories.filter((s) => s.expiresAt > t);
      changed = true;
      for (const s of expiredStories) {
        broadcast({ type: 'story:expired', storyId: s.id });
      }
    }

    if (changed) scheduleSave(store);
  }, 5_000);

  // Bootstrap: only reveals messages/stories/inviteKey to an authenticated partner
  app.get('/api/bootstrap', (req: AuthedRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    const uid = verifySessionToken(token);
    const pinEnabled = Boolean(store.pinHash);

    if (!uid) {
      res.json({
        currentUser: null,
        partner: null,
        users: store.users.map((u) => ({
          id: u.id,
          partnerRole: u.partnerRole,
          handle: u.handle,
          displayName: u.displayName,
          bio: '',
          avatar: u.avatar,
          streakCount: u.streakCount,
          online: u.online,
          lastActiveAt: u.lastActiveAt,
        })),
        conversation: null,
        messages: [],
        stories: [],
        activeCalls: [],
        pinEnabled,
      });
      return;
    }

    const currentUser = store.users.find((u) => u.id === uid) || null;
    const partner = store.users.find((u) => u.id !== uid) || null;

    res.json({
      currentUser,
      partner,
      users: store.users,
      conversation: store.conversation,
      messages: store.messages,
      stories: store.stories.filter((s) => s.expiresAt > nowMs()),
      activeCalls: Array.from(activeCalls.values()),
      inviteKey: store.inviteKey,
      pinEnabled,
    });
  });

  // Authenticate as either You or Your GF (via private inviteKey OR optional Room PIN)
  app.post('/api/auth/enter', (req: Request, res: Response) => {
    const { role, inviteKey, pin } = req.body as {
      role?: 'you' | 'gf';
      inviteKey?: string;
      pin?: string;
    };

    const targetId = role === 'gf' ? PARTNER_GF_ID : PARTNER_YOU_ID;
    const user = store.users.find((u) => u.id === targetId);
    if (!user) {
      res.status(404).json({ error: 'Partner profile not found' });
      return;
    }

    const inviteMatches =
      typeof inviteKey === 'string' &&
      inviteKey.length > 0 &&
      inviteKey.length === store.inviteKey.length &&
      crypto.timingSafeEqual(Buffer.from(inviteKey), Buffer.from(store.inviteKey));

    if (store.pinHash && store.pinSalt && !inviteMatches) {
      if (typeof pin !== 'string' || !verifyPin(pin, store.pinHash, store.pinSalt)) {
        res.status(401).json({ error: 'Incorrect room PIN' });
        return;
      }
    }

    const token = signSessionToken(user.id);
    res.json({ token, user });
  });

  // Set or remove an optional private room PIN
  app.post('/api/couple/pin', requireAuth, (req: AuthedRequest, res: Response) => {
    const { pin } = req.body as { pin?: string | null };
    if (pin === null || pin === '') {
      delete store.pinHash;
      delete store.pinSalt;
      scheduleSave(store);
      res.json({ pinEnabled: false });
      return;
    }
    if (typeof pin !== 'string' || pin.trim().length < 4 || pin.trim().length > 24) {
      res.status(400).json({ error: 'PIN must be between 4 and 24 characters' });
      return;
    }
    const { hash, salt } = hashPin(pin.trim());
    store.pinHash = hash;
    store.pinSalt = salt;
    scheduleSave(store);
    res.json({ pinEnabled: true });
  });

  // Rotate the girlfriend invite link key
  app.post('/api/couple/rotate-invite', requireAuth, (_req: AuthedRequest, res: Response) => {
    store.inviteKey = crypto.randomBytes(12).toString('base64url');
    scheduleSave(store);
    res.json({ inviteKey: store.inviteKey });
  });

  // Update your profile & avatar (or rename partner display name)
  app.patch('/api/profile', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = store.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const { displayName, bio, avatar } = req.body as {
      displayName?: string;
      bio?: string;
      avatar?: Partial<AvatarConfig>;
    };

    if (typeof displayName === 'string' && displayName.trim().length >= 1) {
      user.displayName = displayName.trim().slice(0, 32);
    }
    if (typeof bio === 'string') {
      user.bio = bio.trim().slice(0, 140);
    }
    if (avatar && typeof avatar === 'object') {
      if (typeof avatar.skinTone === 'string' && /^#[0-9A-Fa-f]{6}$/.test(avatar.skinTone)) {
        user.avatar.skinTone = avatar.skinTone;
      }
      if (avatar.hairStyle && VALID_HAIR_STYLES.has(avatar.hairStyle)) {
        user.avatar.hairStyle = avatar.hairStyle;
      }
      if (typeof avatar.hairColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(avatar.hairColor)) {
        user.avatar.hairColor = avatar.hairColor;
      }
      if (avatar.eyewear && VALID_EYEWEAR.has(avatar.eyewear)) {
        user.avatar.eyewear = avatar.eyewear;
      }
      if (typeof avatar.outfitColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(avatar.outfitColor)) {
        user.avatar.outfitColor = avatar.outfitColor;
      }
      if (avatar.accessory && VALID_ACCESSORY.has(avatar.accessory)) {
        user.avatar.accessory = avatar.accessory;
      }
      if (typeof avatar.bgGradient === 'string' && avatar.bgGradient.length <= 60) {
        user.avatar.bgGradient = avatar.bgGradient;
      }
      if (avatar.mood && VALID_MOOD.has(avatar.mood)) {
        user.avatar.mood = avatar.mood;
      }
    }

    scheduleSave(store);
    broadcast({ type: 'user:updated', user });
    res.json({ user });
  });

  // Send a real-time message, voice note, or timed snap to your partner
  app.post('/api/messages', requireAuth, (req: AuthedRequest, res: Response) => {
    const { kind, text, mediaUrl, lensName, ttlSeconds, durationSec } = req.body as {
      kind?: 'text' | 'snap' | 'voice' | 'system';
      text?: string;
      mediaUrl?: string;
      lensName?: string;
      ttlSeconds?: number;
      durationSec?: number;
    };

    const msgKind = kind && ['text', 'snap', 'voice', 'system'].includes(kind) ? kind : 'text';
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 1000) : '';

    if (msgKind === 'text' && !cleanText) {
      res.status(400).json({ error: 'Message text cannot be empty' });
      return;
    }
    if (msgKind === 'snap' && !isSafeMediaUrl(mediaUrl)) {
      res.status(400).json({ error: 'Valid snap image required' });
      return;
    }

    const allowedTtl = typeof ttlSeconds === 'number' && [0, 10, 86400].includes(ttlSeconds) ? ttlSeconds : 0;
    const t = nowMs();

    const message: ChatMessage = {
      id: `msg_${crypto.randomUUID().slice(0, 8)}`,
      conversationId: CONVERSATION_ID,
      senderId: req.userId!,
      kind: msgKind,
      text: cleanText,
      mediaUrl: isSafeMediaUrl(mediaUrl) ? mediaUrl : undefined,
      lensName: typeof lensName === 'string' ? lensName.slice(0, 40) : undefined,
      durationSec: typeof durationSec === 'number' ? Math.min(Math.max(durationSec, 1), 60) : undefined,
      ttlSeconds: allowedTtl,
      createdAt: t,
      expiresAt: allowedTtl === 86400 ? t + 86_400_000 : null,
      viewedBy: [req.userId!],
      reactions: {},
    };

    store.messages.push(message);
    store.conversation.updatedAt = t;
    store.conversation.lastMessagePreview =
      msgKind === 'snap'
        ? cleanText || 'Sent a timed snap'
        : msgKind === 'voice'
          ? 'Sent a voice note'
          : cleanText.slice(0, 60);

    scheduleSave(store);
    broadcast({ type: 'message:created', message });
    res.status(201).json({ message });
  });

  // Mark snap viewed (starts 10s countdown if ttlSeconds === 10)
  app.post('/api/messages/:messageId/view', requireAuth, (req: AuthedRequest, res: Response) => {
    const msg = store.messages.find((m) => m.id === req.params.messageId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (!msg.viewedBy.includes(req.userId!)) {
      msg.viewedBy.push(req.userId!);
      if (msg.ttlSeconds === 10 && !msg.expiresAt) {
        msg.expiresAt = nowMs() + 10_000;
      }
      scheduleSave(store);
      broadcast({ type: 'message:updated', message: msg });
    }

    res.json({ message: msg });
  });

  // Toggle emoji reaction
  app.post('/api/messages/:messageId/react', requireAuth, (req: AuthedRequest, res: Response) => {
    const { emoji } = req.body as { emoji?: string };
    if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 8) {
      res.status(400).json({ error: 'Invalid reaction' });
      return;
    }

    const msg = store.messages.find((m) => m.id === req.params.messageId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const current = msg.reactions[emoji] || [];
    if (current.includes(req.userId!)) {
      msg.reactions[emoji] = current.filter((id) => id !== req.userId);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji] = [...current, req.userId!];
    }

    scheduleSave(store);
    broadcast({ type: 'message:updated', message: msg });
    res.json({ message: msg });
  });

  // Post a private 24h Story for just the two of you
  app.post('/api/stories', requireAuth, (req: AuthedRequest, res: Response) => {
    const { mediaUrl, caption, lensName } = req.body as {
      mediaUrl?: string;
      caption?: string;
      lensName?: string;
    };

    if (!isSafeMediaUrl(mediaUrl)) {
      res.status(400).json({ error: 'Valid image required for story' });
      return;
    }

    const t = nowMs();
    const story: StoryItem = {
      id: `story_${crypto.randomUUID().slice(0, 8)}`,
      authorId: req.userId!,
      mediaUrl,
      caption: typeof caption === 'string' ? caption.trim().slice(0, 140) : '',
      lensName: typeof lensName === 'string' ? lensName.slice(0, 40) : undefined,
      audience: 'us',
      createdAt: t,
      expiresAt: t + 86_400_000,
      viewedBy: [req.userId!],
    };

    store.stories.unshift(story);
    scheduleSave(store);
    broadcast({ type: 'story:created', story });
    res.status(201).json({ story });
  });

  app.post('/api/stories/:storyId/view', requireAuth, (req: AuthedRequest, res: Response) => {
    const story = store.stories.find((s) => s.id === req.params.storyId);
    if (!story) {
      res.status(404).json({ error: 'Story not found' });
      return;
    }
    if (!story.viewedBy.includes(req.userId!)) {
      story.viewedBy.push(req.userId!);
      scheduleSave(store);
      broadcast({ type: 'story:updated', story });
    }
    res.json({ story });
  });

  // Start or join a live voice/video call between You and Your GF
  app.post('/api/calls/start', requireAuth, (req: AuthedRequest, res: Response) => {
    const { mode } = req.body as { mode?: 'audio' | 'video' };
    const callMode = mode === 'audio' ? 'audio' : 'video';

    let session = Array.from(activeCalls.values()).find(
      (c) => c.conversationId === CONVERSATION_ID
    );

    if (!session) {
      session = {
        callId: `call_${crypto.randomUUID().slice(0, 8)}`,
        conversationId: CONVERSATION_ID,
        initiatorId: req.userId!,
        mode: callMode,
        participantIds: [req.userId!],
        startedAt: nowMs(),
      };
      activeCalls.set(session.callId, session);
    } else if (!session.participantIds.includes(req.userId!)) {
      session.participantIds.push(req.userId!);
    }

    broadcast({ type: 'call:state', calls: Array.from(activeCalls.values()) });
    res.json({ call: session });
  });

  app.post('/api/calls/leave', requireAuth, (req: AuthedRequest, res: Response) => {
    const { callId } = req.body as { callId?: string };
    if (!callId || !activeCalls.has(callId)) {
      res.json({ ok: true });
      return;
    }
    const session = activeCalls.get(callId)!;
    session.participantIds = session.participantIds.filter((id) => id !== req.userId);
    if (session.participantIds.length === 0) {
      activeCalls.delete(callId);
    }
    broadcast({ type: 'call:state', calls: Array.from(activeCalls.values()) });
    res.json({ ok: true });
  });

  // Export your shared history (JSON)
  app.get('/api/privacy/export', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = store.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="snaploom-us-${user.partnerRole}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      profile: user,
      stories: store.stories,
      messages: store.messages,
    });
  });

  // Download complete application source bundle (.zip)
  app.get('/api/download-source', async (_req: Request, res: Response) => {
    try {
      const mod = (await import('archiver')) as unknown as {
        ZipArchive: new (options?: ArchiverOptions) => Archiver;
      };
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="snaploom-app.zip"');

      const archive = new mod.ZipArchive({ zlib: { level: 9 } });
      archive.on('error', (err: unknown) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to package archive' });
        }
      });

      archive.pipe(res);

      const rootFiles = [
        'package.json',
        'index.html',
        'metadata.json',
        'tsconfig.json',
        'vite.config.ts',
        'server.ts',
        '.env.example',
      ];
      for (const file of rootFiles) {
        const fullPath = path.resolve(__dirname, file);
        if (fs.existsSync(fullPath)) {
          archive.file(fullPath, { name: file });
        }
      }

      const srcDir = path.resolve(__dirname, 'src');
      if (fs.existsSync(srcDir)) {
        archive.directory(srcDir, 'src');
      }
      const publicDir = path.resolve(__dirname, 'public');
      if (fs.existsSync(publicDir)) {
        archive.directory(publicDir, 'public');
      }

      archive.finalize().catch((err: unknown) => {
        console.error('Archive finalize error:', err);
      });
    } catch (err) {
      console.error('Download source error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to initialize archive' });
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SnapLoom private couple server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
