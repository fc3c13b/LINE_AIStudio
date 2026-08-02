import express from 'express';
import { accountsRepo, usersRepo, resetTokensRepo, hashPassword, verifyPassword, Account } from './db';
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

// S-07: パスワードポリシー検証（8文字以上 + 数字または記号を含む）
function validatePassword(password: string): string | null {
  if (password.length < 8) return 'パスワードは8文字以上で指定してください。';
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return 'パスワードには数字または記号（!@#$など）を1文字以上含めてください。';
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
  const isAdminAccount = name.trim().toLowerCase() === 'administrator' ? 1 : 0;

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
    statusMessage: isAdminAccount ? 'System Administrator' : '新規登録ユーザーです！よろしくお願いします✨',
    isOnline: true,
    isOfficial: isAdminAccount === 1,
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
    return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません。' });
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

  if (!verifyPassword(password, account.passwordHash, account.salt)) {
    return res.status(401).json({ error: 'パスワードが正しくありません。' });
  }

  return res.json({ success: true, message: 'パスワード照合成功' });
});

// パスワード忘れ・再設定コード送信
authRouter.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'メールアドレスを入力してください。' });
  }

  const account = accountsRepo.getByEmail(email);

  if (!account) {
    return res.json({
      success: true,
      message: '入力されたメールアドレスにパスワード再設定コードを発行しました（登録がない場合もメッセージは共通です）。',
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15分有効

  const normalizedEmail = email.trim().toLowerCase();
  resetTokensRepo.deleteByEmail(normalizedEmail);
  resetTokensRepo.insert({ email: normalizedEmail, code, expiresAt });

  console.log(`[AUTH] Password reset requested for ${normalizedEmail}. Reset Code: [ ${code} ]`);

  res.json({
    success: true,
    message: 'パスワード再設定コードを発行しました。下の「再設定コード」に入力してください。',
    devCode: code,
  });
});

// パスワード再設定処理
authRouter.post('/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'すべての項目を入力してください。' });
  }

  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

  const token = resetTokensRepo.findValid(email, code);
  if (!token) {
    return res.status(400).json({ error: '再設定コードが無効か、有効期限（15分）が切れています。' });
  }

  const account = accountsRepo.getByEmail(email);
  if (!account) {
    return res.status(400).json({ error: 'アカウントが見つかりません。' });
  }

  const { hash, salt } = hashPassword(newPassword);
  accountsRepo.updatePassword(account.id, hash, salt);
  resetTokensRepo.deleteByEmail(email);

  console.log(`[AUTH] Password reset completed for ${email.trim().toLowerCase()}`);

  res.json({
    success: true,
    message: 'パスワードが正常に再設定されました。新しいパスワードでログインしてください。',
  });
});
