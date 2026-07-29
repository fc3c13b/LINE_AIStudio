import React, { useState } from 'react';
import { User, ChatRoom } from '../types';
import { Search, UserPlus, Users, Sparkles, ChevronRight, MessageSquare, ShieldCheck, Settings } from 'lucide-react';

interface HomeTabProps {
  currentUser: User;
  users: User[];
  rooms: ChatRoom[];
  onOpenChat: (roomId: string) => void;
  onOpenNewChatModal: () => void;
  onOpenProfileSettings: () => void;
  isLoggedIn?: boolean;
  onOpenAuthModal?: (mode?: 'login' | 'register') => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  currentUser,
  users,
  rooms,
  onOpenChat,
  onOpenNewChatModal,
  onOpenProfileSettings,
  isLoggedIn = false,
  onOpenAuthModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter friends (excluding current user)
  const friends = users.filter((u) => u.id !== currentUser.id && !u.isOfficial);
  const officialAccounts = users.filter((u) => u.isOfficial);
  const groupRooms = rooms.filter((r) => r.isGroup);

  const filteredFriends = friends.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.statusMessage && u.statusMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Top Bar */}
      <div className="sticky top-0 bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">ホーム</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewChatModal}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-700 transition"
            title="友達追加・トーク作成"
          >
            <UserPlus className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenProfileSettings}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-700 transition"
            title="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Profile Card */}
        {isLoggedIn ? (
          <div
            onClick={onOpenProfileSettings}
            className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-300 transition group"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-14 h-14 rounded-full object-cover border border-slate-200 shadow-inner"
                />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base group-hover:text-emerald-600 transition">
                  {currentUser.name}
                </h2>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-medium">
                  {currentUser.statusMessage || 'ステータスメッセージ未設定'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition" />
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 p-4 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold text-lg shrink-0">
                👤
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm">アカウント未登録・未ログイン</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  ユーザー登録するとプロフィールが作成され、LINEトークやアルバムが利用可能になります。
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onOpenAuthModal && onOpenAuthModal('login')}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                ログイン
              </button>
              <button
                onClick={() => onOpenAuthModal && onOpenAuthModal('register')}
                className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition"
              >
                新規アカウント登録
              </button>
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="友達、グループ、サービスを検索"
            className="w-full bg-slate-200/60 pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
          />
        </div>

        {/* Action Quick Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onOpenNewChatModal}
            className="p-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/70 rounded-xl flex items-center gap-2.5 transition text-left"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-950">友達追加・グループ</div>
              <div className="text-[10px] text-emerald-700 font-medium">新規トークを作成</div>
            </div>
          </button>

          <button
            onClick={() => onOpenChat('room-ai')}
            className="p-3 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/70 rounded-xl flex items-center gap-2.5 transition text-left"
          >
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-indigo-950">LINE AI</div>
              <div className="text-[10px] text-indigo-700 font-medium">24時間いつでも質問</div>
            </div>
          </button>
        </div>

        {/* Official Accounts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <span>公式アカウント</span>
            <span className="text-slate-400 font-normal">{officialAccounts.length}</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-sm">
            {officialAccounts.map((acc) => (
              <div
                key={acc.id}
                onClick={() => onOpenChat('room-ai')}
                className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={acc.avatar}
                      alt={acc.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200"
                    />
                    <ShieldCheck className="w-4 h-4 text-emerald-500 fill-emerald-100 absolute -bottom-1 -right-1" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-sm">{acc.name}</span>
                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                        公式
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{acc.statusMessage}</p>
                  </div>
                </div>
                <button className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full hover:bg-emerald-600 transition shadow-sm">
                  トーク
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Friends List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
            <span>友達</span>
            <span className="text-slate-400 font-normal">{filteredFriends.length}</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-sm">
            {filteredFriends.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">該当する友達が見つかりませんでした</div>
            ) : (
              filteredFriends.map((friend) => {
                const room = rooms.find(
                  (r) => !r.isGroup && r.members.some((m) => m.id === friend.id)
                );
                return (
                  <div
                    key={friend.id}
                    onClick={() => {
                      if (room) {
                        onOpenChat(room.id);
                      } else {
                        onOpenNewChatModal();
                      }
                    }}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200"
                        />
                        {friend.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{friend.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {friend.statusMessage || 'ステータスメッセージなし'}
                        </p>
                      </div>
                    </div>
                    <MessageSquare className="w-4 h-4 text-slate-400 hover:text-emerald-500 transition" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Groups */}
        {groupRooms.length > 0 && (
          <div className="space-y-2 pb-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span>グループ</span>
              <span className="text-slate-400 font-normal">{groupRooms.length}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-sm">
              {groupRooms.map((group) => (
                <div
                  key={group.id}
                  onClick={() => onOpenChat(group.id)}
                  className="p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={group.avatar}
                      alt={group.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm">{group.name}</h3>
                        <span className="text-xs text-slate-400 font-normal">
                          ({group.members.length})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {group.members.map((m) => m.name).join(', ')}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
