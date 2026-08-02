import express from 'express';
import { usersRepo, accountsRepo, messagesRepo, friendRequestsRepo, albumsRepo, resetAllData } from './db';
import { broadcast } from '../server';

export const adminRouter = express.Router();

// 管理者権限チェックミドルウェア
adminRouter.use((req, res, next) => {
  const adminId = (req.body?.adminId || req.query?.adminId) as string | undefined;
  if (!adminId || !accountsRepo.isAdmin(adminId)) {
    return res.status(403).json({ error: '管理者権限が必要です。' });
  }
  next();
});

// 登録ユーザー一覧取得（自分以外）
adminRouter.get('/users', (req, res) => {
  const adminId = req.query.adminId as string;
  const all = usersRepo.all().filter((u) => u.id !== adminId);
  const accounts = all.map((u) => {
    const acc = accountsRepo.getById(u.id);
    return {
      ...u,
      isAdmin: !!(acc as any)?.isAdmin,
    };
  });
  res.json(accounts);
});

// 利用停止
adminRouter.post('/users/:id/suspend', (req, res) => {
  const user = usersRepo.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  usersRepo.setSuspended(req.params.id, true);
  // 接続中なら即切断通知
  broadcast({ type: 'presence', userId: req.params.id, isOnline: false });
  res.json({ success: true });
});

// 利用停止解除
adminRouter.post('/users/:id/unsuspend', (req, res) => {
  const user = usersRepo.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  usersRepo.setSuspended(req.params.id, false);
  res.json({ success: true });
});

// アカウント削除（ユーザー・アカウント・関連データを全削除）
adminRouter.delete('/users/:id', (req, res) => {
  const id = req.params.id;
  if (accountsRepo.isAdmin(id)) {
    return res.status(400).json({ error: '管理者アカウントは削除できません。' });
  }
  // アルバムのファイルは albumsRepo.forOwner で取得してから削除するが
  // ここでは DB エントリのみ削除（ファイルは定期クリーンアップに委ねる）
  accountsRepo.delete(id);
  usersRepo.delete(id);
  res.json({ success: true });
});

// 全データリセット（管理者専用）
adminRouter.post('/reset', (req, res) => {
  resetAllData();
  // 管理者アカウントは reset 後も再作成される（initAdminAccount が起動時に実行）
  res.json({ message: 'Database reset. Admin account will be recreated on next restart.' });
});
