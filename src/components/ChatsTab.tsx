import React, { useState } from 'react';
import { ChatRoom, User } from '../types';
import { Search, Pin, MessageSquarePlus, Sparkles, ShieldCheck } from 'lucide-react';

interface ChatsTabProps {
  rooms: ChatRoom[];
  currentUser: User;
  onOpenChat: (roomId: string) => void;
  onOpenNewChatModal: () => void;
}

export const ChatsTab: React.FC<ChatsTabProps> = ({
  rooms,
  currentUser,
  onOpenChat,
  onOpenNewChatModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.lastMessage && r.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort: Pinned first, then by latest message date
  const sortedRooms = [...filteredRooms].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    return timeB - timeA;
  });

  const formatTimestamp = (isoStr: string) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isYesterday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate() - 1;

    if (isYesterday) return '昨日';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between bg-white z-10">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">トーク</h1>
          <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
            v1.2.1 (入力枠常時表示修正完了)
          </span>
        </div>
        <button
          onClick={onOpenNewChatModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00c300] hover:bg-[#00b000] text-white rounded-full text-xs font-bold transition shadow-xs"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>新規トーク</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 bg-slate-50 border-b border-slate-200/60">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="トークルーム、メッセージを検索"
            className="w-full bg-white border border-slate-200/80 pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
          />
        </div>
      </div>

      {/* Room List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {sortedRooms.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 space-y-3">
            <p>トークルームが見つかりません</p>
            <button
              onClick={onOpenNewChatModal}
              className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-xl text-xs"
            >
              新しいトークを開始する
            </button>
          </div>
        ) : (
          sortedRooms.map((room) => {
            const isAiRoom = room.id === 'room-ai';
            return (
              <div
                key={room.id}
                onClick={() => onOpenChat(room.id)}
                className="p-3.5 flex items-center gap-3.5 hover:bg-slate-50 cursor-pointer transition relative group"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={room.avatar}
                    alt={room.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-sm"
                  />
                  {isAiRoom && (
                    <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1 rounded-full shadow">
                      <Sparkles className="w-3 h-3" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="font-bold text-slate-900 text-sm truncate">{room.name}</h2>
                      {room.pinned && <Pin className="w-3 h-3 text-emerald-600 fill-emerald-600 shrink-0" />}
                      {isAiRoom && (
                        <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 font-bold text-[9px] rounded shrink-0">
                          AI
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {formatTimestamp(room.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-500 truncate pr-2">
                      {room.lastMessage
                        ? room.lastMessage.deleted
                          ? '取り消されたメッセージ'
                          : room.lastMessage.type === 'sticker'
                          ? '🎨 スタンプを送信しました'
                          : room.lastMessage.type === 'image'
                          ? '📷 画像を送信しました'
                          : room.lastMessage.type === 'voice'
                          ? '🎙️ ボイスメッセージ'
                          : room.lastMessage.content
                        : 'トークを開始しましょう'}
                    </p>

                    {/* Unread Badge */}
                    {room.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1.5 bg-[#00c300] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                        {room.unreadCount > 99 ? '99+' : room.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
