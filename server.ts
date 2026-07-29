import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { User, ChatRoom, Message, WSMessagePayload } from './src/types';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Password hashing helper
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return newHash === hash;
}

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// Initial seed data
const DEFAULT_USERS: User[] = [];

const INITIAL_ROOMS: ChatRoom[] = [];

const INITIAL_MESSAGES: Message[] = [];

export interface Account {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface ResetToken {
  email: string;
  code: string;
  expiresAt: number;
}

// In-Memory Database + File Persist
interface DBData {
  users: User[];
  rooms: ChatRoom[];
  messages: Message[];
  accounts: Account[];
  resetTokens: ResetToken[];
}

let db: DBData = {
  users: [],
  rooms: [],
  messages: [],
  accounts: [],
  resetTokens: [],
};

const DUMMY_IDS = ['user-sato', 'user-yui', 'user-takumi', 'user-me', 'user-ai'];
const DUMMY_ROOM_IDS = ['room-sato', 'room-group-cafe', 'room-ai'];

function sanitizeData(data: DBData): DBData {
  const users = (data.users || []).filter((u: User) => {
    if (DUMMY_IDS.includes(u.id)) return false;
    if (u.name && (u.name.includes('佐藤') || u.name.includes('田中') || u.name.includes('鈴木') || u.name.includes('LINE AI') || u.name === 'あなた')) return false;
    return true;
  });

  const rooms = (data.rooms || []).filter((r: ChatRoom) => {
    if (DUMMY_ROOM_IDS.includes(r.id)) return false;
    if (r.name && (r.name.includes('カフェ好きサークル') || r.name.includes('佐藤') || r.name.includes('田中') || r.name.includes('鈴木') || r.name.includes('LINE AI'))) return false;
    return true;
  });

  const messages = (data.messages || []).filter((m: Message) => {
    if (DUMMY_IDS.includes(m.senderId)) return false;
    if (DUMMY_ROOM_IDS.includes(m.roomId)) return false;
    return true;
  });

  return {
    users,
    rooms,
    messages,
    accounts: data.accounts || [],
    resetTokens: data.resetTokens || [],
  };
}

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.trim()) {
        const parsed = JSON.parse(content);
        db = sanitizeData(parsed);
        saveDatabase();
        console.log('Database loaded and sanitized successfully from disk');
      }
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to load DB file, using defaults:', err);
    db = { users: [], rooms: [], messages: [], accounts: [], resetTokens: [] };
    saveDatabase();
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save DB file:', err);
  }
}

loadDatabase();

// Update room last messages
function syncRoomLastMessages() {
  db.rooms.forEach((room) => {
    const roomMsgs = db.messages
      .filter((m) => m.roomId === room.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (roomMsgs.length > 0) {
      room.lastMessage = roomMsgs[roomMsgs.length - 1];
    }
  });
}
syncRoomLastMessages();

// Gemini Setup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// Server App & HTTP Server
const app = express();
app.use(express.json());

const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`WebSocket client connected. Total clients: ${clients.size}`);

  // Send initial data sync
  const initData: WSMessagePayload = {
    type: 'init',
    onlineUsers: db.users.filter((u) => u.isOnline).map((u) => u.id),
  };
  ws.send(JSON.stringify(initData));

  ws.on('message', async (data) => {
    try {
      const payload: WSMessagePayload = JSON.parse(data.toString());

      if (payload.type === 'send_message' && payload.message) {
        const msg = payload.message;
        db.messages.push(msg);

        // Update room
        const room = db.rooms.find((r) => r.id === msg.roomId);
        if (room) {
          room.lastMessage = msg;
          room.updatedAt = msg.timestamp;
        }
        saveDatabase();

        // Broadcast new message to all clients
        broadcast({
          type: 'new_message',
          roomId: msg.roomId,
          message: msg,
        });

        // Check if message was sent to LINE AI Assistant
        if (room && (room.id === 'room-ai' || room.members.some((m) => m.id === 'user-ai'))) {
          handleAiReply(msg, room);
        }
      } else if (payload.type === 'typing') {
        broadcast(payload, ws);
      } else if (payload.type === 'read_messages' && payload.roomId && payload.userId) {
        const { roomId, userId } = payload;
        let updatedCount = 0;
        db.messages.forEach((m) => {
          if (m.roomId === roomId && !m.readBy.includes(userId)) {
            m.readBy.push(userId);
            updatedCount++;
          }
        });
        if (updatedCount > 0) {
          saveDatabase();
          broadcast({
            type: 'read_messages',
            roomId,
            userId,
          });
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
  });
});

function broadcast(payload: WSMessagePayload, excludeWs?: WebSocket) {
  const dataStr = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(dataStr);
    }
  });
}

// AI Bot reply handler using Gemini
async function handleAiReply(userMsg: Message, room: ChatRoom) {
  // Broadcast typing indicator
  broadcast({
    type: 'typing',
    roomId: room.id,
    userId: 'user-ai',
    isTyping: true,
  });

  try {
    let replyText = '申し訳ありません。一時的にAIアシスタントを呼び出せませんでした。';

    if (process.env.GEMINI_API_KEY) {
      const ai = getGeminiClient();
      const prompt = `あなたは日本のメッセージアプリ「LINE」の親切でフレンドリーな公式AIアシスタント「LINE AI アシスタント」です。
ユーザーからのメッセージに答えてください。
LINEらしい自然で明るく親しみやすい口調（適度に絵文字を使う）で短め〜中程度の長さで回答してください。

ユーザーのメッセージ: "${userMsg.content}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response.text) {
        replyText = response.text.trim();
      }
    } else {
      replyText = `LINE AIアシスタントです🤖 「${userMsg.content}」についてのご質問ですね！何でもサポートしますよ！✨`;
    }

    // Delay slightly to feel like a natural typing response
    setTimeout(() => {
      // Clear typing
      broadcast({
        type: 'typing',
        roomId: room.id,
        userId: 'user-ai',
        isTyping: false,
      });

      const aiMsg: Message = {
        id: `msg-ai-${Date.now()}`,
        roomId: room.id,
        senderId: 'user-ai',
        senderName: 'LINE AI アシスタント',
        senderAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
        type: 'text',
        content: replyText,
        timestamp: new Date().toISOString(),
        readBy: ['user-ai', userMsg.senderId],
      };

      db.messages.push(aiMsg);
      room.lastMessage = aiMsg;
      room.updatedAt = aiMsg.timestamp;
      saveDatabase();

      broadcast({
        type: 'new_message',
        roomId: room.id,
        message: aiMsg,
      });
    }, 1200);
  } catch (err) {
    console.error('Gemini AI error:', err);
    broadcast({
      type: 'typing',
      roomId: room.id,
      userId: 'user-ai',
      isTyping: false,
    });
  }
}

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', onlineClients: clients.size, totalMessages: db.messages.length });
});

// Authentication Routes
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'ユーザー名、メールアドレス、パスワードをすべて入力してください。' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (db.accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ error: 'このメールアドレスは既に登録されています。' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'パスワードは6文字以上で指定してください。' });
  }

  const userId = `user-${Date.now()}`;
  const { hash, salt } = hashPassword(password);

  const newAccount: Account = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
  };

  const newUser: User = {
    id: userId,
    name: name.trim(),
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
    statusMessage: '新規登録ユーザーです！よろしくお願いします✨',
    isOnline: true,
  };

  db.accounts.push(newAccount);
  db.users.push(newUser);
  saveDatabase();

  console.log(`[AUTH] Registered new user: ${name} (${normalizedEmail})`);

  res.json({
    user: newUser,
    account: { id: newAccount.id, name: newAccount.name, email: newAccount.email },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください。' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const account = db.accounts.find((a) => a.email.toLowerCase() === normalizedEmail);

  if (!account || !verifyPassword(password, account.passwordHash, account.salt)) {
    return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
  }

  let user = db.users.find((u) => u.id === account.id);
  if (!user) {
    user = {
      id: account.id,
      name: account.name,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(account.name)}`,
      statusMessage: 'オンライン',
      isOnline: true,
    };
    db.users.push(user);
    saveDatabase();
  } else {
    user.isOnline = true;
    saveDatabase();
  }

  console.log(`[AUTH] User logged in: ${account.name} (${normalizedEmail})`);

  res.json({
    user,
    account: { id: account.id, name: account.name, email: account.email },
  });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'メールアドレスを入力してください。' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const account = db.accounts.find((a) => a.email.toLowerCase() === normalizedEmail);

  if (!account) {
    // セキュリティ上の理由でアカウントが存在しなくてもメッセージは同じにする（ただしデモ用にもわかりやすく返す）
    return res.json({
      success: true,
      message: '入力されたメールアドレスにパスワード再設定コードを発行しました（登録がない場合もメッセージは共通です）。',
    });
  }

  // 6桁コード生成
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15分有効

  db.resetTokens = db.resetTokens.filter((t) => t.email.toLowerCase() !== normalizedEmail);
  db.resetTokens.push({ email: normalizedEmail, code, expiresAt });
  saveDatabase();

  console.log(`[AUTH] Password reset requested for ${normalizedEmail}. Reset Code: [ ${code} ]`);

  res.json({
    success: true,
    message: 'パスワード再設定コードを発行しました。下の「再設定コード」に入力してください。',
    devCode: code, // デモ・ローカル実行時にその場ですぐテストできるようコードを返却
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'すべての項目を入力してください。' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新しいパスワードは6文字以上で指定してください。' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const tokenIndex = db.resetTokens.findIndex(
    (t) => t.email.toLowerCase() === normalizedEmail && t.code === code.trim() && t.expiresAt > Date.now()
  );

  if (tokenIndex === -1) {
    return res.status(400).json({ error: '再設定コードが無効か、有効期限（15分）が切れています。' });
  }

  const account = db.accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
  if (!account) {
    return res.status(400).json({ error: 'アカウントが見つかりません。' });
  }

  const { hash, salt } = hashPassword(newPassword);
  account.passwordHash = hash;
  account.salt = salt;

  // 使用済みトークン削除
  db.resetTokens.splice(tokenIndex, 1);
  saveDatabase();

  console.log(`[AUTH] Password reset completed for ${normalizedEmail}`);

  res.json({
    success: true,
    message: 'パスワードが正常に再設定されました。新しいパスワードでログインしてください。',
  });
});

app.get('/api/users', (req, res) => {
  res.json(db.users);
});

app.post('/api/users/profile', (req, res) => {
  const { name, statusMessage, avatar } = req.body;
  const me = db.users.find((u) => u.id === 'user-me');
  if (me) {
    if (name) me.name = name;
    if (statusMessage !== undefined) me.statusMessage = statusMessage;
    if (avatar) me.avatar = avatar;
    saveDatabase();
  }
  res.json(me);
});

app.get('/api/rooms', (req, res) => {
  syncRoomLastMessages();
  res.json(db.rooms);
});

app.post('/api/rooms', (req, res) => {
  const { name, memberIds, isGroup, avatar } = req.body;
  const members = db.users.filter((u) => memberIds.includes(u.id) || u.id === 'user-me');

  const newRoom: ChatRoom = {
    id: `room-${Date.now()}`,
    name: name || members.filter((m) => m.id !== 'user-me').map((m) => m.name).join(', '),
    avatar: avatar || members.find((m) => m.id !== 'user-me')?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isGroup: !!isGroup,
    members,
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  };

  db.rooms.unshift(newRoom);
  saveDatabase();

  broadcast({
    type: 'create_room',
    room: newRoom,
  });

  res.json(newRoom);
});

app.get('/api/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const roomMessages = db.messages.filter((m) => m.roomId === roomId);
  res.json(roomMessages);
});

app.post('/api/seed/reset', (req, res) => {
  db = {
    users: DEFAULT_USERS,
    rooms: INITIAL_ROOMS,
    messages: INITIAL_MESSAGES,
    accounts: db.accounts || [],
    resetTokens: [],
  };
  saveDatabase();
  res.json({ message: 'Database reset to default seed' });
});

// Vite / Static setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LINE App full-stack server running on http://localhost:${PORT}`);
  });
}

startServer();
