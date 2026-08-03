import express from 'express';
import { accountsRepo, usersRepo, hashPassword, verifyPassword, Account } from './db';
import { User } from '../src/types';

export const authRouter = express.Router();

// S-04: IPごとのレートリミット（15分間に最大10回）
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function enforceRateLimit(req: express.Request, res: express.Response): boolean {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const key = `${ip}:${req.path}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) {
    res.status(429).json({ error: 'しばらく時間をおいてから再試行してください（15分後に解除）。' });
    return false;
  }
  entry.count += 1;
  return true;
}

// S-07: パスワードポリシー検証（4文字以上）
function validatePassword(password: string): string | null {
  if (password.length < 4) return 'パスワードは4文字以上で指定してください。';
  return null;
}

// ユーザー新規登録
authRouter.post('/register', (req, res) => {
  if (!enforceRateLimit(req, res)) return;

  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください。' });
  }

  if (accountsRepo.getByName(name)) {
    return res.status(400).json({ error: 'このユーザー名は既に登録されています。' });
  }

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  const userId = `user-${Date.now()}`;
  const { hash, salt } = hashPassword(password);
  const ADMIN_NAMES = ['administrator', 'admin'];
  const isAdminAccount = ADMIN_NAMES.includes(name.trim().toLowerCase()) ? 1 : 0;

  const newAccount: Account = {
    id: userId,
    name: name.trim(),
    email: '',
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString(),
    isAdmin: isAdminAccount,
  };

  const newUser: User = {
    id: userId,
    name: name.trim(),
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
    statusMessage: isAdminAccount ? 'System Administrator' : 'HELLO WORLD',
    isOnline: true,
    isOfficial: false,
    friendIds: [],
  };

  accountsRepo.insert(newAccount);
  usersRepo.upsert(newUser);

  console.log(`[AUTH] Registered new user: ${name}${isAdminAccount ? ' (admin)' : ''}`);

  res.json({
    user: newUser,
    account: { id: newAccount.id, name: newAccount.name, isAdmin: isAdminAccount === 1 },
  });
});

// ログイン
authRouter.post('/login', (req, res) => {
  if (!enforceRateLimit(req, res)) return;

  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ error: 'ユーザー名とパスワードを入力してください。' });
  }

  const account = accountsRepo.getByName(name);

  if (!account || !verifyPassword(password, account.passwordHash, account.salt)) {
    // サブパスワードも確認
    const sub = account && (account as any).passwordHash2 && (account as any).salt2
      ? verifyPassword(password, (account as any).passwordHash2, (account as any).salt2)
      : false;
    if (!account || !sub) {
      return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません。' });
    }
  }

  let user = usersRepo.get(account.id);
  if (!user) {
    user = {
      id: account.id,
      name: account.name,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(account.name)}`,
      statusMessage: 'オンライン',
      isOnline: true,
      friendIds: [],
    };
    usersRepo.upsert(user);
  } else {
    if (user.isSuspended) {
      return res.status(403).json({ error: 'このアカウントは利用停止中です。管理者にお問い合わせください。' });
    }
    user.isOnline = true;
    if (!user.friendIds) user.friendIds = [];
    usersRepo.upsert(user);
  }

  console.log(`[AUTH] User logged in: ${account.name}`);

  res.json({
    user,
    account: { id: account.id, name: account.name, isAdmin: !!(account as any).isAdmin },
  });
});

// パスワード検証（画面ロック解除時）
authRouter.post('/verify-password', (req, res) => {
  const { email, accountId, password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'パスワードを入力してください。' });
  }

  let account: Account | undefined;
  if (email) {
    account = accountsRepo.getByEmail(email);
  } else if (accountId) {
    account = accountsRepo.getById(accountId);
  }

  if (!account) {
    return res.status(404).json({ error: 'アカウントが見つかりません。' });
  }

  const pass1Ok = verifyPassword(password, account.passwordHash, account.salt);
  const pass2Ok = (account as any).passwordHash2 && (account as any).salt2
    ? verifyPassword(password, (account as any).passwordHash2, (account as any).salt2)
    : false;
  if (!pass1Ok && !pass2Ok) {
    return res.status(401).json({ error: 'パスワードが正しくありません。' });
  }

  return res.json({ success: true, message: 'パスワード照合成功' });
});

// サブパスワード設定
authRouter.post('/set-secondary-password', (req, res) => {
  const { accountId, currentPassword, newPassword2 } = req.body;

  if (!accountId || !currentPassword) {
    return res.status(400).json({ error: '現在のパスワードを入力してください。' });
  }

  const account = accountsRepo.getById(accountId);
  if (!account) {
    return res.status(404).json({ error: 'アカウントが見つかりません。' });
  }
  if (!verifyPassword(currentPassword, account.passwordHash, account.salt)) {
    return res.status(401).json({ error: '現在のパスワードが正しくありません。' });
  }

  if (!newPassword2) {
    // クリア
    accountsRepo.setSecondaryPassword(accountId, null, null);
    return res.json({ success: true, message: 'サブパスワードを削除しました。' });
  }

  const pwError = validatePassword(newPassword2);
  if (pwError) return res.status(400).json({ error: pwError });

  const { hash, salt } = hashPassword(newPassword2);
  accountsRepo.setSecondaryPassword(accountId, hash, salt);

  console.log(`[AUTH] Secondary password set for account: ${account.name}`);
  return res.json({ success: true, message: 'サブパスワードを設定しました。' });
});
