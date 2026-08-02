import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { User, ChatRoom, Message, FriendRequest, Album } from '../src/types';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

export interface Account {
  id: string;
  name: string;
  // Retained for compatibility with older records. New username-based accounts store an empty value.
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

export interface DBData {
  users: User[];
  rooms: ChatRoom[];
  messages: Message[];
  accounts: Account[];
  resetTokens: ResetToken[];
  friendRequests: FriendRequest[];
  albums: Album[];
}

export const DEFAULT_USERS: User[] = [];
export const INITIAL_ROOMS: ChatRoom[] = [];
export const INITIAL_MESSAGES: Message[] = [];

export let db: DBData = {
  users: [],
  rooms: [],
  messages: [],
  accounts: [],
  resetTokens: [],
  friendRequests: [],
  albums: [],
};

// Password hashing helper
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return newHash === hash;
}

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
    friendRequests: data.friendRequests || [],
    albums: data.albums || [],
  };
}

export function loadDatabase() {
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
    console.error('Failed to load DB file:', err);
  }
}

export function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save DB file:', err);
  }
}

export function syncRoomLastMessages() {
  db.rooms.forEach((room) => {
    const roomMsgs = db.messages
      .filter((m) => m.roomId === room.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (roomMsgs.length > 0) {
      room.lastMessage = roomMsgs[roomMsgs.length - 1];
    }
  });
}

// Initial load
loadDatabase();
syncRoomLastMessages();
