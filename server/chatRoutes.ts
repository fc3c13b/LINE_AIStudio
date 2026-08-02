import express from 'express';
import { usersRepo, roomsRepo, messagesRepo, friendRequestsRepo, resetAllData } from './db';
import { broadcast } from '../server';
import { ChatRoom, User, FriendRequest } from '../src/types';

export const chatRouter = express.Router();

// ユーザー一覧取得
chatRouter.get('/users', (req, res) => {
  res.json(usersRepo.all());
});

// 友達追加
chatRouter.post('/users/add-friend', (req, res) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId と friendId を指定してください。' });
  }

  const user = usersRepo.get(userId);
  const friend = usersRepo.get(friendId);

  if (!user || !friend) {
    return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  }

  addMutualFriends(user, friend);
  usersRepo.upsert(user);
  usersRepo.upsert(friend);
  res.json({ success: true, user, friend });
});

// 友達解除
chatRouter.post('/users/remove-friend', (req, res) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId と friendId を指定してください。' });
  }

  const user = usersRepo.get(userId);
  const friend = usersRepo.get(friendId);

  if (user && user.friendIds) {
    user.friendIds = user.friendIds.filter((id) => id !== friendId);
    usersRepo.upsert(user);
  }

  if (friend && friend.friendIds) {
    friend.friendIds = friend.friendIds.filter((id) => id !== userId);
    usersRepo.upsert(friend);
  }

  res.json({ success: true });
});

// ユーザープロフィール更新
chatRouter.post('/users/profile', (req, res) => {
  const { userId, name, statusMessage, avatar } = req.body;
  const me = usersRepo.get(userId);
  if (me) {
    if (name) me.name = name;
    if (statusMessage !== undefined) me.statusMessage = statusMessage;
    if (avatar) me.avatar = avatar;
    usersRepo.upsert(me);

    // プロフィール変更を全クライアントへ通知
    broadcast({ type: 'user_update', user: me });
  }
  res.json(me);
});

// 友達申請一覧取得（受信・送信）
chatRouter.get('/friend-requests', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'userId を指定してください。' });
  }
  res.json(friendRequestsRepo.forUser(userId));
});

// 友達申請送信
chatRouter.post('/friend-requests', (req, res) => {
  const { fromUserId, toUserId } = req.body;
  if (!fromUserId || !toUserId) {
    return res.status(400).json({ error: 'fromUserId と toUserId を指定してください。' });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ error: '自分自身には友達申請できません。' });
  }

  const from = usersRepo.get(fromUserId);
  const to = usersRepo.get(toUserId);
  if (!from || !to) {
    return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  }

  // 既に友達
  if (from.friendIds?.includes(toUserId)) {
    return res.status(400).json({ error: '既に友達です。' });
  }

  // 既存の pending 申請があれば重複させない
  const existing = friendRequestsRepo.pendingBetween(fromUserId, toUserId);
  if (existing) {
    return res.json({ success: true, request: existing });
  }

  // 相手からの pending 申請が既にあれば相互申請として即承認
  const reverse = friendRequestsRepo.pendingBetween(toUserId, fromUserId);
  const now = new Date().toISOString();
  if (reverse) {
    friendRequestsRepo.updateStatus(reverse.id, 'accepted', now);
    reverse.status = 'accepted';
    reverse.updatedAt = now;
    addMutualFriends(from, to);
    usersRepo.upsert(from);
    usersRepo.upsert(to);
    broadcast({ type: 'friend_request', friendRequest: reverse });
    broadcast({ type: 'user_update', user: from });
    broadcast({ type: 'user_update', user: to });
    return res.json({ success: true, request: reverse, autoAccepted: true });
  }

  const request: FriendRequest = {
    id: `fr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  friendRequestsRepo.insert(request);

  broadcast({ type: 'friend_request', friendRequest: request });
  res.json({ success: true, request });
});

// 友達申請承認
chatRouter.post('/friend-requests/:id/accept', (req, res) => {
  const request = friendRequestsRepo.get(req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ error: '申請が見つからないか、既に処理済みです。' });
  }

  const from = usersRepo.get(request.fromUserId);
  const to = usersRepo.get(request.toUserId);
  if (!from || !to) {
    return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  }

  const now = new Date().toISOString();
  friendRequestsRepo.updateStatus(request.id, 'accepted', now);
  request.status = 'accepted';
  request.updatedAt = now;
  addMutualFriends(from, to);
  usersRepo.upsert(from);
  usersRepo.upsert(to);

  broadcast({ type: 'friend_request', friendRequest: request });
  broadcast({ type: 'user_update', user: from });
  broadcast({ type: 'user_update', user: to });
  res.json({ success: true, request });
});

// 友達申請拒否
chatRouter.post('/friend-requests/:id/reject', (req, res) => {
  const request = friendRequestsRepo.get(req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ error: '申請が見つからないか、既に処理済みです。' });
  }
  const now = new Date().toISOString();
  friendRequestsRepo.updateStatus(request.id, 'rejected', now);
  request.status = 'rejected';
  request.updatedAt = now;

  broadcast({ type: 'friend_request', friendRequest: request });
  res.json({ success: true, request });
});

// 友達申請キャンセル（送信者側）
chatRouter.post('/friend-requests/:id/cancel', (req, res) => {
  const request = friendRequestsRepo.get(req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ error: '申請が見つからないか、既に処理済みです。' });
  }
  const now = new Date().toISOString();
  friendRequestsRepo.updateStatus(request.id, 'canceled', now);
  request.status = 'canceled';
  request.updatedAt = now;

  broadcast({ type: 'friend_request', friendRequest: request });
  res.json({ success: true, request });
});

// トークルーム一覧取得（userId 指定時は自分がメンバーのルームのみ）
chatRouter.get('/rooms', (req, res) => {
  const userId = req.query.userId as string | undefined;
  if (userId) {
    return res.json(roomsRepo.forUser(userId));
  }
  res.json(roomsRepo.all());
});

// 新規トークルーム作成
chatRouter.post('/rooms', (req, res) => {
  const { name, memberIds, isGroup, avatar, ownerId } = req.body;
  const ids: string[] = Array.isArray(memberIds) ? [...memberIds] : [];
  if (ownerId && !ids.includes(ownerId)) ids.push(ownerId);
  const members = ids.map((id) => usersRepo.get(id)).filter((u): u is User => !!u);

  const others = members.filter((m) => m.id !== ownerId);
  const newRoom: ChatRoom = {
    id: `room-${Date.now()}`,
    name: name || others.map((m) => m.name).join(', ') || 'トーク',
    avatar: avatar || others[0]?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isGroup: !!isGroup,
    members,
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  };

  roomsRepo.insert(newRoom);

  broadcast({
    type: 'create_room',
    room: newRoom,
  });

  res.json(newRoom);
});

// 特定トークルームのメッセージ取得（ページネーション対応）
// ?before=<ISO timestamp>&limit=<n> で過去方向へ遡って取得
chatRouter.get('/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const before = req.query.before as string | undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 200);
  res.json(messagesRepo.forRoom(roomId, { before, limit }));
});

// メッセージ検索（D-02: 全文検索）。?q=&roomId=(任意)
chatRouter.get('/messages/search', (req, res) => {
  const q = (req.query.q as string) || '';
  const roomId = req.query.roomId as string | undefined;
  res.json({ messages: messagesRepo.search(q, roomId) });
});

// データベースリセット
chatRouter.post('/seed/reset', (req, res) => {
  resetAllData();
  res.json({ message: 'Database reset to default seed' });
});

// 双方向に友達登録するヘルパー
function addMutualFriends(a: User, b: User) {
  if (!a.friendIds) a.friendIds = [];
  if (!b.friendIds) b.friendIds = [];
  if (!a.friendIds.includes(b.id)) a.friendIds.push(b.id);
  if (!b.friendIds.includes(a.id)) b.friendIds.push(a.id);
}
