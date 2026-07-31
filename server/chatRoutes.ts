import express from 'express';
import { db, saveDatabase, syncRoomLastMessages, DEFAULT_USERS, INITIAL_ROOMS, INITIAL_MESSAGES } from './db';
import { broadcast } from '../server';
import { ChatRoom, User } from '../src/types';

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
  const { name, statusMessage, avatar } = req.body;
  const me = db.users.find((u) => u.id === 'user-me');
  if (me) {
    if (name) me.name = name;
    if (statusMessage !== undefined) me.statusMessage = statusMessage;
    if (avatar) me.avatar = avatar;
    saveDatabase();
  }
  res.json(me);
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

// 特定トークルームのメッセージ取得
chatRouter.get('/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const roomMessages = db.messages.filter((m) => m.roomId === roomId);
  res.json(roomMessages);
});

// データベースリセット
chatRouter.post('/seed/reset', (req, res) => {
  db.users = DEFAULT_USERS;
  db.rooms = INITIAL_ROOMS;
  db.messages = INITIAL_MESSAGES;
  db.resetTokens = [];
  saveDatabase();
  res.json({ message: 'Database reset to default seed' });
});
