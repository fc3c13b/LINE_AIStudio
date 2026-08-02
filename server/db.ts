// このモジュールは後方互換のための集約ポイント。
// 実データは server/database.ts の SQLite リポジトリが保持する。
export {
  usersRepo,
  accountsRepo,
  roomsRepo,
  messagesRepo,
  friendRequestsRepo,
  albumsRepo,
  resetTokensRepo,
  hashPassword,
  verifyPassword,
  resetAllData,
  backupDatabase,
} from './database';

export type { Account, ResetToken } from './database';

import { migrateFromJsonIfNeeded } from './database';

// 起動時に一度だけ旧 JSON DB から移行し、SQLite を準備
export function initDatabase(): void {
  migrateFromJsonIfNeeded();
  console.log('[DB] SQLite database ready');
}
