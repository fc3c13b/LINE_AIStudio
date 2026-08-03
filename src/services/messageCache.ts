import { Message } from '../types';

const PREFIX = 'lmsg_';
const IDX_KEY = 'lmsg_idx'; // roomId[] in LRU order (oldest first)
const LIMIT_BYTES = 10 * 1024 * 1024; // 10MB (localStorage quota safe)

function totalSize(): number {
  let size = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) size += (localStorage.getItem(k) || '').length * 2; // UTF-16
  }
  return size;
}

function getIndex(): string[] {
  try { return JSON.parse(localStorage.getItem(IDX_KEY) || '[]'); } catch { return []; }
}

/** 起動時にキャッシュから全メッセージを復元する */
export function loadAllCachedMessages(): Record<string, Message[]> {
  const result: Record<string, Message[]> = {};
  try {
    for (const roomId of getIndex()) {
      const raw = localStorage.getItem(PREFIX + roomId);
      if (raw) result[roomId] = JSON.parse(raw);
    }
  } catch {}
  return result;
}

/** ルームのメッセージをキャッシュに保存（LRUで10MB上限管理） */
export function cacheRoomMessages(roomId: string, messages: Message[]): void {
  if (!messages.length) return;
  try {
    // 上限超過時は古いルームから削除
    while (totalSize() > LIMIT_BYTES) {
      const idx = getIndex();
      if (!idx.length) break;
      localStorage.removeItem(PREFIX + idx[0]);
      localStorage.setItem(IDX_KEY, JSON.stringify(idx.slice(1)));
    }
    localStorage.setItem(PREFIX + roomId, JSON.stringify(messages));
    const idx = getIndex().filter(id => id !== roomId);
    idx.push(roomId); // 末尾 = 最新アクセス
    localStorage.setItem(IDX_KEY, JSON.stringify(idx));
  } catch {
    // QuotaExceededError 時はキャッシュを全クリア
    clearMessageCache();
  }
}

/** ログアウト時などにキャッシュを全削除 */
export function clearMessageCache(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX) || k === IDX_KEY) keys.push(k!);
  }
  keys.forEach(k => localStorage.removeItem(k));
}
