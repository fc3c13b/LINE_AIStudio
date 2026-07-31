import express from 'express';
import { db, saveDatabase, hashPassword, verifyPassword, Account } from './db';
import { User } from '../src/types';

export const authRouter = express.Router();

// ユーザー新規登録
authRouter.post('/register', (req, res) => {
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
    friendIds: [],
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

// ログイン
authRouter.post('/login', (req, res) => {
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
      friendIds: [],
    };
    db.users.push(user);
    saveDatabase();
  } else {
    user.isOnline = true;
    if (!user.friendIds) user.friendIds = [];
    saveDatabase();
  }

  console.log(`[AUTH] User logged in: ${account.name} (${normalizedEmail})`);

  res.json({
    user,
    account: { id: account.id, name: account.name, email: account.email },
  });
});

// パスワード検証（画面ロック解除時）
authRouter.post('/verify-password', (req, res) => {
  const { email, accountId, password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'パスワードを入力してください。' });
  }

  let account;
  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    account = db.accounts.find((a) => a.email.toLowerCase() === normalizedEmail);
  } else if (accountId) {
    account = db.accounts.find((a) => a.id === accountId);
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

  const normalizedEmail = email.trim().toLowerCase();
  const account = db.accounts.find((a) => a.email.toLowerCase() === normalizedEmail);

  if (!account) {
    return res.json({
      success: true,
      message: '入力されたメールアドレスにパスワード再設定コードを発行しました（登録がない場合もメッセージは共通です）。',
    });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15分有効

  db.resetTokens = db.resetTokens.filter((t) => t.email.toLowerCase() !== normalizedEmail);
  db.resetTokens.push({ email: normalizedEmail, code, expiresAt });
  saveDatabase();

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

  db.resetTokens.splice(tokenIndex, 1);
  saveDatabase();

  console.log(`[AUTH] Password reset completed for ${normalizedEmail}`);

  res.json({
    success: true,
    message: 'パスワードが正常に再設定されました。新しいパスワードでログインしてください。',
  });
});
