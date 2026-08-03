import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { User, ChatRoom, Message, WSMessagePayload } from './src/types';
import { usersRepo, roomsRepo, messagesRepo, initDatabase, backupDatabase } from './server/db';
import { authRouter } from './server/authRoutes';
import { chatRouter } from './server/chatRoutes';
import { albumRouter } from './server/albumRoutes';
import { adminRouter } from './server/adminRoutes';
import { musicRouter } from './server/musicRoutes';

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
// JSON/テキストAPIレスポンスをgzip圧縮（通信量60〜80%削減）
app.use(compression());

// Uploads directory static serving
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// 1日キャッシュ + ETTag で画像・音楽の再ダウンロードを防止
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d', etag: true }));

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
        usersRepo.setOnline(payload.userId, true);
        broadcast({
          type: 'presence',
          userId: payload.userId,
          isOnline: true,
        });
        // 最新のオンライン一覧を本人へ返す
        ws.send(JSON.stringify({ type: 'init', onlineUsers: onlineUserIds() }));
      } else if (payload.type === 'sync' && payload.since) {
        // 再接続時の欠損メッセージ補完: since 以降のメッセージを返す
        const missed = messagesRepo.since(payload.since);
        ws.send(JSON.stringify({ type: 'sync_result', messages: missed }));
      } else if (payload.type === 'send_message' && payload.message) {
        const msg = payload.message;
        messagesRepo.insert(msg);

        // Update room
        const room = roomsRepo.get(msg.roomId);
        if (room) {
          roomsRepo.setLastMessage(room.id, msg);
        }

        // ルームメンバーのみへ新着を配信 (P-04)
        broadcastToRoom(msg.roomId, {
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
        const target = messagesRepo.get(payload.messageId);
        if (target) {
          target.deleted = true;
          target.content = '';
          target.reactions = {};
          messagesRepo.update(target);
          const room = roomsRepo.get(target.roomId);
          if (room && room.lastMessage?.id === target.id) {
            roomsRepo.setLastMessage(room.id, target);
          }
          broadcastToRoom(target.roomId, {
            type: 'delete_message',
            roomId: target.roomId,
            messageId: target.id,
          });
        }
      } else if (payload.type === 'reaction' && payload.messageId && payload.emoji && payload.userId) {
        // 絵文字リアクションのトグル永続化
        const target = messagesRepo.get(payload.messageId);
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
          messagesRepo.update(target);
          broadcastToRoom(target.roomId, {
            type: 'reaction',
            roomId: target.roomId,
            messageId: target.id,
            reactions: target.reactions,
          });
        }
      } else if (payload.type === 'typing' && payload.roomId) {
        broadcastToRoom(payload.roomId, payload, ws);
      } else if (payload.type === 'read_messages' && payload.roomId && payload.userId) {
        const { roomId, userId } = payload;
        const updatedCount = messagesRepo.markRoomRead(roomId, userId);
        if (updatedCount > 0) {
          broadcastToRoom(roomId, {
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
      const lastSeen = new Date().toISOString();
      usersRepo.setOnline(userId, false, lastSeen);
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

// P-04: 指定ルームのメンバー（および未識別接続）にのみ配信
export function broadcastToRoom(roomId: string, payload: WSMessagePayload, excludeWs?: WebSocket) {
  const room = roomsRepo.get(roomId);
  // ルームが取得できない場合は全体配信にフォールバック
  if (!room) {
    broadcast(payload, excludeWs);
    return;
  }
  const memberIds = new Set(room.members.map((m) => m.id));
  const dataStr = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client === excludeWs || client.readyState !== WebSocket.OPEN) return;
    const uid = wsUserMap.get(client);
    // 未識別の接続、またはメンバーのみに配信
    if (!uid || memberIds.has(uid)) {
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

      messagesRepo.insert(aiMsg);
      roomsRepo.setLastMessage(room.id, aiMsg);

      broadcastToRoom(room.id, {
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
  res.json({ status: 'ok', onlineClients: clients.size });
});

// File Upload Route (Saves photo/video files to server disk)
const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'text/plain': 'txt', 'text/html': 'html', 'text/csv': 'csv',
  'text/markdown': 'md', 'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/json': 'json', 'application/zip': 'zip',
};
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, dataUrl, userId } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ error: 'dataUrl is required' });
    }

    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Invalid dataUrl format' });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];

    // S-05: MIMEタイプ許可リスト検証
    const ext = ALLOWED_UPLOAD_MIME[mimeType];
    if (!ext) {
      return res.status(415).json({ error: `未対応のファイル形式です: ${mimeType}` });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // S-05: サイズ上限検証
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'ファイルサイズが上限(50MB)を超えています。' });
    }

    // D-03: ユーザーごとのディレクトリに保存
    const safeUserId = typeof userId === 'string' ? userId.replace(/[^a-zA-Z0-9_-]/g, '') : '';
    const targetDir = safeUserId ? path.join(UPLOADS_DIR, safeUserId) : UPLOADS_DIR;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(targetDir, fileId);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = safeUserId ? `/uploads/${safeUserId}/${fileId}` : `/uploads/${fileId}`;
    console.log(`[UPLOAD] File saved to server: ${filePath} -> ${fileUrl}`);

    // 画像の場合はチャット表示用サムネイルを自動生成（純粋JSのjimpを使用）
    const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
    if (IMAGE_EXTS.has(ext)) {
      try {
        const JimpMod = require('jimp');
        const Jimp = JimpMod.Jimp ?? JimpMod.default ?? JimpMod;
        const image = await Jimp.read(filePath);
        const MAX_THUMB = 480;
        if (image.width > MAX_THUMB || image.height > MAX_THUMB) {
          image.width > image.height
            ? image.resize({ w: MAX_THUMB })
            : image.resize({ h: MAX_THUMB });
        }
        const buf = await image.getBuffer('image/jpeg');
        const thumbId = fileId.replace(/\.[^.]+$/, '-mini.jpg');
        const thumbPath = path.join(targetDir, thumbId);
        fs.writeFileSync(thumbPath, buf);
        const thumbUrl = safeUserId ? `/uploads/${safeUserId}/${thumbId}` : `/uploads/${thumbId}`;
        console.log(`[UPLOAD] Thumbnail generated: ${thumbUrl}`);
        return res.json({ url: fileUrl, thumbUrl, fileName: fileName || fileId, mimeType });
      } catch (thumbErr) {
        console.warn('[UPLOAD] Thumbnail generation failed:', thumbErr);
      }
    }

    return res.json({ url: fileUrl, fileName: fileName || fileId, mimeType });
  } catch (err) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: 'Failed to upload file to server' });
  }
});

// チャット内メディアのファイル削除（送信取消時に呼ばれる）
app.delete('/api/upload', (req, res) => {
  try {
    const url = req.body?.url;
    if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    const relative = url.replace(/^\/uploads\//, '');
    const target = path.resolve(UPLOADS_DIR, relative);
    if (!target.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      console.log(`[UPLOAD] File deleted: ${target}`);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('File delete error:', err);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Authentication Routes
app.use('/api/auth', authRouter);

// Chat & User Routes
app.use('/api', chatRouter);

// Music SMB Routes
app.use('/api/music', musicRouter);

// Album Routes
app.use('/api', albumRouter);

// Admin Routes
app.use('/api/admin', adminRouter);

// Vite / Static setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // vite は devDependencies のため本番ビルドには含めず動的インポート
    const { createServer: createViteServer } = await import('vite');
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

// SQLite 初期化（旧 JSON からの移行を含む）
initDatabase();

// D-05: 定期バックアップ（6時間ごと、最新7世代を保持）
setInterval(() => {
  const file = backupDatabase(7);
  if (file) console.log(`[DB] Backup created: ${file}`);
}, 6 * 60 * 60 * 1000);

startServer();
