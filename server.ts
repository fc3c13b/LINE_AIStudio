import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { User, ChatRoom, Message, WSMessagePayload } from './src/types';

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// Initial seed data
const DEFAULT_USERS: User[] = [
  {
    id: 'user-me',
    name: 'あなた',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    statusMessage: 'プログラミング勉強中 💻',
    isOnline: true,
  },
  {
    id: 'user-ai',
    name: 'LINE AI アシスタント',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    statusMessage: 'いつでも何でも質問してください🤖✨',
    isOfficial: true,
    isOnline: true,
  },
  {
    id: 'user-sato',
    name: '佐藤 健太',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    statusMessage: '今夜は飲むぞー！🍺',
    isOnline: true,
  },
  {
    id: 'user-yui',
    name: '田中 結衣',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    statusMessage: '新作カフェ巡り☕️',
    isOnline: false,
  },
  {
    id: 'user-takumi',
    name: '鈴木 拓海',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    statusMessage: '沖縄旅行中 🏝️',
    isOnline: false,
  },
];

const INITIAL_ROOMS: ChatRoom[] = [
  {
    id: 'room-ai',
    name: 'LINE AI アシスタント',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    isGroup: false,
    members: [DEFAULT_USERS[0], DEFAULT_USERS[1]],
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
    pinned: true,
  },
  {
    id: 'room-sato',
    name: '佐藤 健太',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    isGroup: false,
    members: [DEFAULT_USERS[0], DEFAULT_USERS[2]],
    unreadCount: 1,
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    pinned: false,
  },
  {
    id: 'room-group-cafe',
    name: 'カフェ好きサークル ☕️',
    avatar: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=150&auto=format&fit=crop&q=80',
    isGroup: true,
    members: [DEFAULT_USERS[0], DEFAULT_USERS[2], DEFAULT_USERS[3], DEFAULT_USERS[4]],
    unreadCount: 0,
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    pinned: false,
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-ai-1',
    roomId: 'room-ai',
    senderId: 'user-ai',
    senderName: 'LINE AI アシスタント',
    senderAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    type: 'text',
    content: 'こんにちは！LINE AI アシスタントです🤖 何かお手伝いできることはありますか？雑談やご質問などお気軽にメッセージをお送りください！',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    readBy: ['user-me', 'user-ai'],
  },
  {
    id: 'msg-sato-1',
    roomId: 'room-sato',
    senderId: 'user-sato',
    senderName: '佐藤 健太',
    senderAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    type: 'text',
    content: 'お疲れ！今週末、渋谷で飲む予定だけど来れる？🍻',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    readBy: ['user-sato'],
  },
  {
    id: 'msg-group-1',
    roomId: 'room-group-cafe',
    senderId: 'user-yui',
    senderName: '田中 結衣',
    senderAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    type: 'text',
    content: 'みんな！表参道に新しい抹茶カフェができたみたいだよ〜🍵',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    readBy: ['user-me', 'user-sato', 'user-yui', 'user-takumi'],
  },
  {
    id: 'msg-group-2',
    roomId: 'room-group-cafe',
    senderId: 'user-me',
    senderName: 'あなた',
    senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    type: 'text',
    content: '行きたい！今度の土曜日どうかな？',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
    readBy: ['user-me', 'user-sato', 'user-yui', 'user-takumi'],
  },
];

// In-Memory Database + File Persist
interface DBData {
  users: User[];
  rooms: ChatRoom[];
  messages: Message[];
}

let db: DBData = {
  users: DEFAULT_USERS,
  rooms: INITIAL_ROOMS,
  messages: INITIAL_MESSAGES,
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.trim()) {
        db = JSON.parse(content);
        console.log('Database loaded successfully from disk');
      }
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to load DB file, using defaults:', err);
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
