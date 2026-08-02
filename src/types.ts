export interface User {
  id: string;
  name: string;
  avatar: string;
  statusMessage?: string;
  isOfficial?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  friendIds?: string[];
}

export type MessageType = 'text' | 'sticker' | 'image' | 'video' | 'voice' | 'system';

// 引用リプライ元メッセージの要約情報
export interface ReplyReference {
  messageId: string;
  senderName: string;
  type: MessageType;
  preview: string; // テキスト抜粋またはメディア種別ラベル
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  type: MessageType;
  content: string; // text, sticker URL/id, image URL, or audio URL
  timestamp: string; // ISO string or format
  readBy: string[]; // User IDs who have read this
  replyTo?: ReplyReference; // 引用リプライ元
  reactions?: Record<string, string[]>; // emoji -> リアクションしたユーザーIDの配列
  deleted?: boolean; // 送信取消済みフラグ
  meta?: {
    duration?: number; // for voice
    fileName?: string;
    stickerCategory?: string;
  };
}

export interface ChatRoom {
  id: string;
  name: string;
  avatar: string;
  isGroup: boolean;
  members: User[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
  pinned?: boolean;
}

export interface Sticker {
  id: string;
  category: string;
  name: string;
  emoji: string;
  imageUrl: string;
}

// 友達申請
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MusicItem {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  url: string; // Blob URL, Data URL, or remote URL
  coverUrl?: string;
  format: string; // 'mp3' | 'mp4' | 'm4a' | 'flac' | string
  fileSize?: string;
  createdAt: string;
}

export type TabType = 'home' | 'chats' | 'album' | 'music' | 'settings';

export interface CallState {
  isActive: boolean;
  roomId: string;
  contactName: string;
  contactAvatar: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended';
  duration: number;
}

export type WSMessageType =
  | 'init'
  | 'identify'
  | 'join_room'
  | 'send_message'
  | 'new_message'
  | 'delete_message'
  | 'reaction'
  | 'typing'
  | 'read_messages'
  | 'presence'
  | 'sync'
  | 'sync_result'
  | 'create_room'
  | 'user_update'
  | 'friend_request';

export interface WSMessagePayload {
  type: WSMessageType;
  userId?: string;
  roomId?: string;
  message?: Message;
  messages?: Message[];
  messageId?: string;
  user?: User;
  room?: ChatRoom;
  isTyping?: boolean;
  readMessageIds?: string[];
  onlineUsers?: string[];
  emoji?: string;
  reactions?: Record<string, string[]>;
  since?: string; // sync: この時刻以降のメッセージを要求
  isOnline?: boolean; // presence
  lastSeen?: string; // presence
  friendRequest?: FriendRequest;
}
