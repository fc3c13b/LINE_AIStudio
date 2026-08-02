import express from 'express';
import { db, saveDatabase, syncRoomLastMessages, DEFAULT_USERS, INITIAL_ROOMS, INITIAL_MESSAGES } from './db';
import { broadcast } from '../server';
import { ChatRoom, User, FriendRequest } from '../src/types';

export const chatRouter = express.Router();

// ユーザー一覧取得
chatRouter.get('/users', (req, res) => {
  res.json(db.users);
});

// 友達追加
chatRouter.post('/users/add-friend', (req, res) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId と friendId を指定してください。' });
  }

  const user = db.users.find((u) => u.id === userId);
  const friend = db.users.find((u) => u.id === friendId);

  if (!user || !friend) {
    return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  }

  if (!user.friendIds) user.friendIds = [];
  if (!user.friendIds.includes(friendId)) {
    user.friendIds.push(friendId);
  }

  if (!friend.friendIds) friend.friendIds = [];
  if (!friend.friendIds.includes(userId)) {
    friend.friendIds.push(userId);
  }

  saveDatabase();
  res.json({ success: true, user, friend });
});

// 友達解除
chatRouter.post('/users/remove-friend', (req, res) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ error: 'userId と friendId を指定してください。' });
  }

  const user = db.users.find((u) => u.id === userId);
  const friend = db.users.find((u) => u.id === friendId);

  if (user && user.friendIds) {
    user.friendIds = user.friendIds.filter((id) => id !== friendId);
  }

  if (friend && friend.friendIds) {
    friend.friendIds = friend.friendIds.filter((id) => id !== userId);
  }

  saveDatabase();
  res.json({ success: true });
});

// ユーザープロフィール更新
chatRouter.post('/users/profile', (req, res) => {
  const { userId, name, statusMessage, avatar } = req.body;
  const targetId = userId || 'user-me';
  const me = db.users.find((u) => u.id === targetId);
  if (me) {
    if (name) me.name = name;
    if (statusMessage !== undefined) me.statusMessage = statusMessage;
    if (avatar) me.avatar = avatar;
    saveDatabase();

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
  const incoming = db.friendRequests.filter((r) => r.toUserId === userId && r.status === 'pending');
  const outgoing = db.friendRequests.filter((r) => r.fromUserId === userId && r.status === 'pending');
  res.json({ incoming, outgoing });
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

  const from = db.users.find((u) => u.id === fromUserId);
  const to = db.users.find((u) => u.id === toUserId);
  if (!from || !to) {
    return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  }

  // 既に友達
  if (from.friendIds?.includes(toUserId)) {
    return res.status(400).json({ error: '既に友達です。' });
  }

  // 既存の pending 申請があれば重複させない
  const existing = db.friendRequests.find(
    (r) => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending'
  );
  if (existing) {
    return res.json({ success: true, request: existing });
  }

  // 相手からの pending 申請が既にあれば相互申請として即承認
  const reverse = db.friendRequests.find(
    (r) => r.fromUserId === toUserId && r.toUserId === fromUserId && r.status === 'pending'
  );
  const now = new Date().toISOString();
  if (reverse) {
    reverse.status = 'accepted';
    reverse.updatedAt = now;
    addMutualFriends(from, to);
    saveDatabase();
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
  db.friendRequests.push(request);
  saveDatabase();

  broadcast({ type: 'friend_request', friendRequest: request });
  res.json({ success: true, request });
});

// 友達申請承認
chatRouter.post('/friend-requests/:id/accept', (req, res) => {
  const request = db.friendRequests.find((r) => r.id === req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ error: '申請が見つからないか、既に処理済みです。' });
  }

  const from = db.users.find((u) => u.id === request.fromUserId);
  const to = db.users.find((u) => u.id === request.toUserId);
  if (!from || !to) {
    return res.status(404).json({ error: 'ユーザーが見つかりません。' });
  }

  request.status = 'accepted';
  request.updatedAt = new Date().toISOString();
  addMutualFriends(from, to);
  saveDatabase();

  broadcast({ type: 'friend_request', friendRequest: request });
  broadcast({ type: 'user_update', user: from });
  broadcast({ type: 'user_update', user: to });
  res.json({ success: true, request });
});

// 友達申請拒否
chatRouter.post('/friend-requests/:id/reject', (req, res) => {
  const request = db.friendRequests.find((r) => r.id === req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ error: '申請が見つからないか、既に処理済みです。' });
  }
  request.status = 'rejected';
  request.updatedAt = new Date().toISOString();
  saveDatabase();

  broadcast({ type: 'friend_request', friendRequest: request });
  res.json({ success: true, request });
});

// 友達申請キャンセル（送信者側）
chatRouter.post('/friend-requests/:id/cancel', (req, res) => {
  const request = db.friendRequests.find((r) => r.id === req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ error: '申請が見つからないか、既に処理済みです。' });
  }
  request.status = 'canceled';
  request.updatedAt = new Date().toISOString();
  saveDatabase();

  broadcast({ type: 'friend_request', friendRequest: request });
  res.json({ success: true, request });
});

// トークルーム一覧取得
chatRouter.get('/rooms', (req, res) => {
  syncRoomLastMessages();
  res.json(db.rooms);
});

// 新規トークルーム作成
chatRouter.post('/rooms', (req, res) => {
  const { name, memberIds, isGroup, avatar } = req.body;
  const members = db.users.filter((u) => memberIds.includes(u.id) || u.id === 'user-me');

  const newRoom: ChatRoom = {
    id: `room-${Date.now()}`,
    name: name || members.filter((m) => m.id !== 'user-me').map((m) => m.name).join(', '),
    avatar: avatar || members.find((m) => m.id !== 'user-me')?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isGroup: !!isGroup,
    members,
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  };

  db.rooms.unshift(newRoom);
  saveDatabase();

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

  let roomMessages = db.messages
    .filter((m) => m.roomId === roomId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (before) {
    const beforeTime = new Date(before).getTime();
    roomMessages = roomMessages.filter((m) => new Date(m.timestamp).getTime() < beforeTime);
  }

  const total = roomMessages.length;
  // 末尾（最新）から limit 件を返す
  const page = roomMessages.slice(Math.max(0, total - limit));
  const hasMore = total > limit;

  res.json({ messages: page, hasMore });
});

// データベースリセット
chatRouter.post('/seed/reset', (req, res) => {
  db.users = DEFAULT_USERS;
  db.rooms = INITIAL_ROOMS;
  db.messages = INITIAL_MESSAGES;
  db.resetTokens = [];
  db.friendRequests = [];
  db.albums = [];
  saveDatabase();
  res.json({ message: 'Database reset to default seed' });
});

// 双方向に友達登録するヘルパー
function addMutualFriends(a: User, b: User) {
  if (!a.friendIds) a.friendIds = [];
  if (!b.friendIds) b.friendIds = [];
  if (!a.friendIds.includes(b.id)) a.friendIds.push(b.id);
  if (!b.friendIds.includes(a.id)) b.friendIds.push(a.id);
}
