import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { User, ChatRoom, Message, WSMessagePayload } from './src/types';
import { db, saveDatabase, syncRoomLastMessages, hashPassword, verifyPassword, Account, ResetToken, DEFAULT_USERS, INITIAL_ROOMS, INITIAL_MESSAGES } from './server/db';
import { authRouter } from './server/authRoutes';
import { chatRouter } from './server/chatRoutes';

export { db, saveDatabase, syncRoomLastMessages, hashPassword, verifyPassword, DEFAULT_USERS, INITIAL_ROOMS, INITIAL_MESSAGES };
export type { Account, ResetToken };

const PORT = 3000;

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
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'https://localhost' || origin === 'http://localhost' || origin === 'capacitor://localhost') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Uploads directory static serving
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();
// ws と userId の対応（同一ユーザーの複数接続も許容）
const wsUserMap = new Map<WebSocket, string>();

function onlineUserIds(): string[] {
  return Array.from(new Set(Array.from(wsUserMap.values())));
}

// あるユーザーがまだ他の接続を持っているか
function isUserStillOnline(userId: string): boolean {
  for (const id of wsUserMap.values()) {
    if (id === userId) return true;
  }
  return false;
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`WebSocket client connected. Total clients: ${clients.size}`);

  // Send initial data sync
  const initData: WSMessagePayload = {
    type: 'init',
    onlineUsers: onlineUserIds(),
  };
  ws.send(JSON.stringify(initData));

  ws.on('message', async (data) => {
    try {
      const payload: WSMessagePayload = JSON.parse(data.toString());

      if (payload.type === 'identify' && payload.userId) {
        // 接続とユーザーを関連付け、オンライン状態を更新・通知
        wsUserMap.set(ws, payload.userId);
        const user = db.users.find((u) => u.id === payload.userId);
        if (user) {
          user.isOnline = true;
          saveDatabase();
        }
        broadcast({
          type: 'presence',
          userId: payload.userId,
          isOnline: true,
        });
        // 最新のオンライン一覧を本人へ返す
        ws.send(JSON.stringify({ type: 'init', onlineUsers: onlineUserIds() }));
      } else if (payload.type === 'sync' && payload.since) {
        // 再接続時の欠損メッセージ補完: since 以降のメッセージを返す
        const sinceTime = new Date(payload.since).getTime();
        const missed = db.messages.filter((m) => new Date(m.timestamp).getTime() > sinceTime);
        ws.send(JSON.stringify({ type: 'sync_result', messages: missed }));
      } else if (payload.type === 'send_message' && payload.message) {
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
      } else if (payload.type === 'delete_message' && payload.messageId) {
        // 送信取消: 内容を消しフラグを立てる
        const target = db.messages.find((m) => m.id === payload.messageId);
        if (target) {
          target.deleted = true;
          target.content = '';
          target.reactions = {};
          const room = db.rooms.find((r) => r.id === target.roomId);
          if (room && room.lastMessage?.id === target.id) {
            room.lastMessage = target;
          }
          saveDatabase();
          broadcast({
            type: 'delete_message',
            roomId: target.roomId,
            messageId: target.id,
          });
        }
      } else if (payload.type === 'reaction' && payload.messageId && payload.emoji && payload.userId) {
        // 絵文字リアクションのトグル永続化
        const target = db.messages.find((m) => m.id === payload.messageId);
        if (target) {
          if (!target.reactions) target.reactions = {};
          const users = target.reactions[payload.emoji] || [];
          if (users.includes(payload.userId)) {
            target.reactions[payload.emoji] = users.filter((id) => id !== payload.userId);
            if (target.reactions[payload.emoji].length === 0) {
              delete target.reactions[payload.emoji];
            }
          } else {
            target.reactions[payload.emoji] = [...users, payload.userId];
          }
          saveDatabase();
          broadcast({
            type: 'reaction',
            roomId: target.roomId,
            messageId: target.id,
            reactions: target.reactions,
          });
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
    const userId = wsUserMap.get(ws);
    wsUserMap.delete(ws);
    if (userId && !isUserStillOnline(userId)) {
      // このユーザーの最後の接続が切れた: オフライン化
      const user = db.users.find((u) => u.id === userId);
      const lastSeen = new Date().toISOString();
      if (user) {
        user.isOnline = false;
        user.lastSeen = lastSeen;
        saveDatabase();
      }
      broadcast({
        type: 'presence',
        userId,
        isOnline: false,
        lastSeen,
      });
    }
    console.log(`WebSocket client disconnected. Total clients: ${clients.size}`);
  });
});

export function broadcast(payload: WSMessagePayload, excludeWs?: WebSocket) {
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

// File Upload Route (Saves photo/video files to server disk)
app.post('/api/upload', (req, res) => {
  try {
    const { fileName, dataUrl } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: 'dataUrl is required' });
    }

    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid dataUrl format' });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let ext = 'bin';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('mp4')) ext = 'mp4';
    else if (mimeType.includes('webm')) ext = 'webm';
    else if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = 'mov';

    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileId);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${fileId}`;
    console.log(`[UPLOAD] File saved to server: ${filePath} -> ${fileUrl}`);

    return res.json({ url: fileUrl, fileName: fileName || fileId, mimeType });
  } catch (err) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: 'Failed to upload file to server' });
  }
});

// Authentication Routes
app.use('/api/auth', authRouter);

// Chat & User Routes
app.use('/api', chatRouter);

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
