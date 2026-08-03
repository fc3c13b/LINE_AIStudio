import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { User, ChatRoom, Message, FriendRequest, Album } from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app.db');
const LEGACY_JSON = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export interface Account {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  isAdmin?: number; // 1 = admin
  passwordHash2?: string | null;
  salt2?: string | null;
}

export interface ResetToken {
  email: string;
  code: string;
  expiresAt: number;
}

// ---- パスワードハッシュ ----
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return newHash === hash;
}

// ---- DB 初期化 ----
const sqlite = new DatabaseSync(DB_FILE);
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    statusMessage TEXT,
    isOfficial INTEGER DEFAULT 0,
    isOnline INTEGER DEFAULT 0,
    lastSeen TEXT,
    friendIds TEXT DEFAULT '[]',
    isSuspended INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    passwordHash TEXT NOT NULL,
    salt TEXT NOT NULL,
    createdAt TEXT,
    isAdmin INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT,
    avatar TEXT,
    isGroup INTEGER DEFAULT 0,
    members TEXT DEFAULT '[]',
    lastMessage TEXT,
    unreadCount INTEGER DEFAULT 0,
    updatedAt TEXT,
    pinned INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    roomId TEXT NOT NULL,
    senderId TEXT,
    senderName TEXT,
    senderAvatar TEXT,
    type TEXT,
    content TEXT,
    timestamp TEXT,
    readBy TEXT DEFAULT '[]',
    replyTo TEXT,
    reactions TEXT,
    deleted INTEGER DEFAULT 0,
    meta TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(roomId, timestamp);
  CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    fromUserId TEXT,
    toUserId TEXT,
    status TEXT,
    createdAt TEXT,
    updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    ownerId TEXT,
    name TEXT,
    items TEXT DEFAULT '[]',
    createdAt TEXT,
    updatedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS reset_tokens (
    email TEXT,
    code TEXT,
    expiresAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// 既存DBへの後方互換: prepared statement 作成前に列を追加
 try { sqlite.exec(`ALTER TABLE users ADD COLUMN isSuspended INTEGER DEFAULT 0`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE accounts ADD COLUMN isAdmin INTEGER DEFAULT 0`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE accounts ADD COLUMN passwordHash2 TEXT`); } catch { /* already exists */ }
try { sqlite.exec(`ALTER TABLE accounts ADD COLUMN salt2 TEXT`); } catch { /* already exists */ }

// D-02: メッセージ全文検索 (FTS5)。未対応環境ではLIKEにフォールバック
let ftsEnabled = false;
try {
  sqlite.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(id UNINDEXED, roomId UNINDEXED, content);`);
  ftsEnabled = true;
} catch {
  ftsEnabled = false;
}

// ---- 行 <-> ドメイン変換 ----
function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToUser(r: any): User {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar || '',
    statusMessage: r.statusMessage || undefined,
    isOfficial: !!r.isOfficial,
    isOnline: !!r.isOnline,
    lastSeen: r.lastSeen || undefined,
    friendIds: parseJson<string[]>(r.friendIds, []),
    isSuspended: !!r.isSuspended,
  };
}

function rowToRoom(r: any): ChatRoom {
  return {
    id: r.id,
    name: r.name,
    avatar: r.avatar || '',
    isGroup: !!r.isGroup,
    members: parseJson<User[]>(r.members, []),
    lastMessage: r.lastMessage ? parseJson<Message>(r.lastMessage, undefined as any) : undefined,
    unreadCount: r.unreadCount || 0,
    updatedAt: r.updatedAt,
    pinned: !!r.pinned,
  };
}

function rowToMessage(r: any): Message {
  return {
    id: r.id,
    roomId: r.roomId,
    senderId: r.senderId,
    senderName: r.senderName,
    senderAvatar: r.senderAvatar,
    type: r.type,
    content: r.content ?? '',
    timestamp: r.timestamp,
    readBy: parseJson<string[]>(r.readBy, []),
    replyTo: r.replyTo ? parseJson<Message['replyTo']>(r.replyTo, undefined) : undefined,
    reactions: r.reactions ? parseJson<Message['reactions']>(r.reactions, undefined) : undefined,
    deleted: !!r.deleted,
    meta: r.meta ? parseJson<Message['meta']>(r.meta, undefined) : undefined,
  };
}

function rowToAlbum(r: any): Album {
  return {
    id: r.id,
    ownerId: r.ownerId,
    name: r.name,
    items: parseJson<Album['items']>(r.items, []),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt || undefined,
  };
}

// ---- Users ----
const stmtInsertUser = sqlite.prepare(
  `INSERT OR REPLACE INTO users (id, name, avatar, statusMessage, isOfficial, isOnline, lastSeen, friendIds, isSuspended)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

export const usersRepo = {
  all(): User[] {
    return sqlite.prepare('SELECT * FROM users').all().map(rowToUser);
  },
  get(id: string): User | undefined {
    const r = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return r ? rowToUser(r) : undefined;
  },
  upsert(u: User): void {
    stmtInsertUser.run(
      u.id,
      u.name,
      u.avatar || '',
      u.statusMessage ?? null,
      u.isOfficial ? 1 : 0,
      u.isOnline ? 1 : 0,
      u.lastSeen ?? null,
      JSON.stringify(u.friendIds || []),
      u.isSuspended ? 1 : 0
    );
  },
  setSuspended(id: string, suspended: boolean): void {
    sqlite.prepare('UPDATE users SET isSuspended = ? WHERE id = ?').run(suspended ? 1 : 0, id);
  },
  delete(id: string): void {
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
  setOnline(id: string, isOnline: boolean, lastSeen?: string): void {
    sqlite.prepare('UPDATE users SET isOnline = ?, lastSeen = COALESCE(?, lastSeen) WHERE id = ?')
      .run(isOnline ? 1 : 0, lastSeen ?? null, id);
  },
  onlineIds(): string[] {
    return sqlite.prepare('SELECT id FROM users WHERE isOnline = 1').all().map((r: any) => r.id);
  },
};

// ---- Accounts ----
export const accountsRepo = {
  getByName(name: string): Account | undefined {
    const trimmed = name.trim();
    return sqlite.prepare('SELECT * FROM accounts WHERE trim(name) = ?').get(trimmed) as Account | undefined;
  },
  getById(id: string): Account | undefined {
    return sqlite.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
  },
  getByEmail(email: string): Account | undefined {
    return sqlite.prepare('SELECT * FROM accounts WHERE lower(email) = ?').get(email.trim().toLowerCase()) as Account | undefined;
  },
  insert(a: Account): void {
    sqlite.prepare(
      `INSERT INTO accounts (id, name, email, passwordHash, salt, createdAt, isAdmin) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(a.id, a.name, a.email, a.passwordHash, a.salt, a.createdAt, a.isAdmin ?? 0);
  },
  setSecondaryPassword(id: string, passwordHash2: string | null, salt2: string | null): void {
    sqlite.prepare('UPDATE accounts SET passwordHash2 = ?, salt2 = ? WHERE id = ?').run(passwordHash2, salt2, id);
  },
  updatePassword(id: string, passwordHash: string, salt: string): void {
    sqlite.prepare('UPDATE accounts SET passwordHash = ?, salt = ? WHERE id = ?').run(passwordHash, salt, id);
  },
  delete(id: string): void {
    sqlite.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },
  isAdmin(id: string): boolean {
    const r = sqlite.prepare('SELECT isAdmin FROM accounts WHERE id = ?').get(id) as any;
    return r?.isAdmin === 1;
  },
};

// ---- Rooms ----
export const roomsRepo = {
  all(): ChatRoom[] {
    return sqlite.prepare('SELECT * FROM rooms ORDER BY updatedAt DESC').all().map(rowToRoom);
  },
  // 指定ユーザーがメンバーのルームのみ返す
  forUser(userId: string): ChatRoom[] {
    return sqlite
      .prepare(`SELECT * FROM rooms WHERE members LIKE ? ORDER BY updatedAt DESC`)
      .all(`%"${userId}"%`)
      .map(rowToRoom);
  },
  get(id: string): ChatRoom | undefined {
    const r = sqlite.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    return r ? rowToRoom(r) : undefined;
  },
  insert(room: ChatRoom): void {
    sqlite.prepare(
      `INSERT OR REPLACE INTO rooms (id, name, avatar, isGroup, members, lastMessage, unreadCount, updatedAt, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      room.id,
      room.name,
      room.avatar || '',
      room.isGroup ? 1 : 0,
      JSON.stringify(room.members || []),
      room.lastMessage ? JSON.stringify(room.lastMessage) : null,
      room.unreadCount || 0,
      room.updatedAt,
      room.pinned ? 1 : 0
    );
  },
  setLastMessage(roomId: string, message: Message): void {
    sqlite.prepare('UPDATE rooms SET lastMessage = ?, updatedAt = ? WHERE id = ?')
      .run(JSON.stringify(message), message.timestamp, roomId);
  },
};

// ---- Messages ----
const stmtInsertMessage = sqlite.prepare(
  `INSERT OR REPLACE INTO messages (id, roomId, senderId, senderName, senderAvatar, type, content, timestamp, readBy, replyTo, reactions, deleted, meta)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

export const messagesRepo = {
  // ページネーション: 最新から limit 件、before 指定時はそれより前
  forRoom(roomId: string, opts: { before?: string; limit?: number } = {}): { messages: Message[]; hasMore: boolean } {
    const limit = Math.min(opts.limit || 50, 200);
    const params: unknown[] = [roomId];
    let where = 'roomId = ?';
    if (opts.before) {
      where += ' AND timestamp < ?';
      params.push(opts.before);
    }
    const total = (sqlite.prepare(`SELECT COUNT(*) c FROM messages WHERE ${where}`).get(...params) as any).c as number;
    const rows = sqlite
      .prepare(`SELECT * FROM messages WHERE ${where} ORDER BY timestamp DESC LIMIT ?`)
      .all(...params, limit)
      .map(rowToMessage)
      .reverse();
    return { messages: rows, hasMore: total > limit };
  },
  since(timestamp: string): Message[] {
    return sqlite.prepare('SELECT * FROM messages WHERE timestamp > ? ORDER BY timestamp ASC').all(timestamp).map(rowToMessage);
  },
  get(id: string): Message | undefined {
    const r = sqlite.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    return r ? rowToMessage(r) : undefined;
  },
  insert(m: Message): void {
    stmtInsertMessage.run(
      m.id, m.roomId, m.senderId, m.senderName, m.senderAvatar, m.type, m.content, m.timestamp,
      JSON.stringify(m.readBy || []),
      m.replyTo ? JSON.stringify(m.replyTo) : null,
      m.reactions ? JSON.stringify(m.reactions) : null,
      m.deleted ? 1 : 0,
      m.meta ? JSON.stringify(m.meta) : null
    );
    if (ftsEnabled && m.type === 'text' && !m.deleted) {
      try {
        sqlite.prepare('INSERT INTO messages_fts (id, roomId, content) VALUES (?, ?, ?)').run(m.id, m.roomId, m.content);
      } catch { /* noop */ }
    }
  },
  update(m: Message): void {
    this.insert(m);
  },
  markRoomRead(roomId: string, userId: string): number {
    const rows = sqlite.prepare('SELECT id, readBy FROM messages WHERE roomId = ?').all(roomId);
    let changed = 0;
    const upd = sqlite.prepare('UPDATE messages SET readBy = ? WHERE id = ?');
    for (const r of rows) {
      const readBy = parseJson<string[]>((r as any).readBy, []);
      if (!readBy.includes(userId)) {
        readBy.push(userId);
        upd.run(JSON.stringify(readBy), (r as any).id);
        changed++;
      }
    }
    return changed;
  },
  // D-02: 全文検索（FTS5 または LIKE フォールバック）
  search(query: string, roomId?: string): Message[] {
    const q = query.trim();
    if (!q) return [];
    if (ftsEnabled) {
      const rows = roomId
        ? sqlite.prepare(
            `SELECT m.* FROM messages_fts f JOIN messages m ON m.id = f.id WHERE messages_fts MATCH ? AND f.roomId = ? AND m.deleted = 0 ORDER BY m.timestamp DESC LIMIT 100`
          ).all(q, roomId)
        : sqlite.prepare(
            `SELECT m.* FROM messages_fts f JOIN messages m ON m.id = f.id WHERE messages_fts MATCH ? AND m.deleted = 0 ORDER BY m.timestamp DESC LIMIT 100`
          ).all(q);
      return rows.map(rowToMessage);
    }
    const like = `%${q}%`;
    const rows = roomId
      ? sqlite.prepare(`SELECT * FROM messages WHERE type='text' AND deleted=0 AND roomId=? AND content LIKE ? ORDER BY timestamp DESC LIMIT 100`).all(roomId, like)
      : sqlite.prepare(`SELECT * FROM messages WHERE type='text' AND deleted=0 AND content LIKE ? ORDER BY timestamp DESC LIMIT 100`).all(like);
    return rows.map(rowToMessage);
  },
};

// ---- Friend Requests ----
export const friendRequestsRepo = {
  forUser(userId: string): { incoming: FriendRequest[]; outgoing: FriendRequest[] } {
    const incoming = sqlite.prepare(`SELECT * FROM friend_requests WHERE toUserId = ? AND status = 'pending'`).all(userId) as FriendRequest[];
    const outgoing = sqlite.prepare(`SELECT * FROM friend_requests WHERE fromUserId = ? AND status = 'pending'`).all(userId) as FriendRequest[];
    return { incoming, outgoing };
  },
  get(id: string): FriendRequest | undefined {
    return sqlite.prepare('SELECT * FROM friend_requests WHERE id = ?').get(id) as FriendRequest | undefined;
  },
  pendingBetween(fromUserId: string, toUserId: string): FriendRequest | undefined {
    return sqlite.prepare(
      `SELECT * FROM friend_requests WHERE fromUserId = ? AND toUserId = ? AND status = 'pending'`
    ).get(fromUserId, toUserId) as FriendRequest | undefined;
  },
  insert(r: FriendRequest): void {
    sqlite.prepare(
      `INSERT INTO friend_requests (id, fromUserId, toUserId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(r.id, r.fromUserId, r.toUserId, r.status, r.createdAt, r.updatedAt);
  },
  updateStatus(id: string, status: FriendRequest['status'], updatedAt: string): void {
    sqlite.prepare('UPDATE friend_requests SET status = ?, updatedAt = ? WHERE id = ?').run(status, updatedAt, id);
  },
};

// ---- Albums ----
export const albumsRepo = {
  forOwner(ownerId: string): Album[] {
    return sqlite.prepare('SELECT * FROM albums WHERE ownerId = ? ORDER BY COALESCE(updatedAt, createdAt) DESC').all(ownerId).map(rowToAlbum);
  },
  forOwners(ownerIds: string[]): Album[] {
    if (ownerIds.length === 0) return [];
    const placeholders = ownerIds.map(() => '?').join(',');
    return sqlite.prepare(`SELECT * FROM albums WHERE ownerId IN (${placeholders}) ORDER BY COALESCE(updatedAt, createdAt) DESC`).all(...ownerIds).map(rowToAlbum);
  },
  get(id: string): Album | undefined {
    const r = sqlite.prepare('SELECT * FROM albums WHERE id = ?').get(id);
    return r ? rowToAlbum(r) : undefined;
  },
  insert(a: Album): void {
    sqlite.prepare(
      `INSERT OR REPLACE INTO albums (id, ownerId, name, items, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(a.id, a.ownerId, a.name, JSON.stringify(a.items || []), a.createdAt, a.updatedAt ?? null);
  },
  save(a: Album): void {
    this.insert(a);
  },
  delete(id: string): void {
    sqlite.prepare('DELETE FROM albums WHERE id = ?').run(id);
  },
};

// ---- Reset Tokens ----
export const resetTokensRepo = {
  deleteByEmail(email: string): void {
    sqlite.prepare('DELETE FROM reset_tokens WHERE lower(email) = ?').run(email.trim().toLowerCase());
  },
  insert(t: ResetToken): void {
    sqlite.prepare('INSERT INTO reset_tokens (email, code, expiresAt) VALUES (?, ?, ?)').run(t.email, t.code, t.expiresAt);
  },
  findValid(email: string, code: string): ResetToken | undefined {
    return sqlite.prepare(
      'SELECT * FROM reset_tokens WHERE lower(email) = ? AND code = ? AND expiresAt > ?'
    ).get(email.trim().toLowerCase(), code.trim(), Date.now()) as ResetToken | undefined;
  },
  deleteAll(): void {
    sqlite.exec('DELETE FROM reset_tokens');
  },
};

// ---- 全データリセット ----
export function resetAllData(): void {
  sqlite.exec(`
    DELETE FROM users; DELETE FROM accounts; DELETE FROM rooms;
    DELETE FROM messages; DELETE FROM friend_requests; DELETE FROM albums; DELETE FROM reset_tokens;
  `);
  if (ftsEnabled) {
    try { sqlite.exec('DELETE FROM messages_fts;'); } catch { /* noop */ }
  }
}

// ---- D-05: バックアップ（VACUUM INTO で一貫スナップショット）----
export function backupDatabase(keep = 7): string | null {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(BACKUP_DIR, `app-${stamp}.db`);
    sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    // 古いバックアップを削除（最新 keep 件を残す）
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.db')).sort();
    while (files.length > keep) {
      const old = files.shift();
      if (old) fs.rmSync(path.join(BACKUP_DIR, old), { force: true });
    }
    return target;
  } catch (err) {
    console.error('Backup failed:', err);
    return null;
  }
}

// ---- 旧 JSON DB からの一度きり移行 ----
function isDummy(id?: string, name?: string): boolean {
  const DUMMY_IDS = ['user-sato', 'user-yui', 'user-takumi', 'user-me', 'user-ai'];
  if (id && DUMMY_IDS.includes(id)) return true;
  if (name && (name.includes('佐藤') || name.includes('田中') || name.includes('鈴木') || name.includes('LINE AI') || name === 'あなた')) return true;
  return false;
}

export function migrateFromJsonIfNeeded(): void {
  const migrated = sqlite.prepare(`SELECT value FROM meta WHERE key = 'json_migrated'`).get() as any;
  if (migrated) return;

  if (fs.existsSync(LEGACY_JSON)) {
    try {
      const content = fs.readFileSync(LEGACY_JSON, 'utf-8');
      if (content.trim()) {
        const data = JSON.parse(content);
        (data.users || []).forEach((u: User) => { if (!isDummy(u.id, u.name)) usersRepo.upsert(u); });
        (data.accounts || []).forEach((a: Account) => { try { accountsRepo.insert(a); } catch { /* dup */ } });
        (data.rooms || []).forEach((r: ChatRoom) => { if (!isDummy(r.id, r.name)) roomsRepo.insert(r); });
        (data.messages || []).forEach((m: Message) => { if (!isDummy(m.senderId) && !isDummy(m.roomId)) messagesRepo.insert(m); });
        (data.friendRequests || []).forEach((fr: FriendRequest) => { try { friendRequestsRepo.insert(fr); } catch { /* dup */ } });
        (data.albums || []).forEach((al: Album) => albumsRepo.insert(al));
        console.log('[DB] Migrated legacy db.json into SQLite');
      }
    } catch (err) {
      console.error('[DB] Legacy JSON migration failed:', err);
    }
    // 移行後の JSON はバックアップとしてリネーム
    try { fs.renameSync(LEGACY_JSON, `${LEGACY_JSON}.migrated`); } catch { /* noop */ }
  }

  sqlite.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('json_migrated', ?)`).run(new Date().toISOString());
}

// ---- 管理者アカウントの初期化（カラム追加のみ・既存登録済まで対応）----
export function initAdminAccount(): void {
  // administrator と admin の両方に isAdmin を付与
  for (const adminName of ['administrator', 'admin']) {
    const existing = accountsRepo.getByName(adminName);
    if (existing && !existing.isAdmin) {
      sqlite.prepare('UPDATE accounts SET isAdmin = 1 WHERE id = ?').run(existing.id);
      console.log(`[DB] Granted admin to existing ${adminName} account`);
    }
  }
}

export { sqlite };
