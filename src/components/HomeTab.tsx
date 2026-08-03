import React, { useState } from 'react';
import { User, ChatRoom, FriendRequest } from '../types';
import { Search, UserPlus, Users, ChevronRight, MessageSquare, Settings, UserX, Check, X, Clock, Bell, Shield } from 'lucide-react';

interface HomeTabProps {
  currentUser: User;
  users: User[];
  rooms: ChatRoom[];
  onOpenChat: (roomId: string) => void;
  onOpenNewChatModal: () => void;
  onOpenProfileSettings: () => void;
  isLoggedIn?: boolean;
  onOpenAuthModal?: (mode?: 'login' | 'register') => void;
  onSendFriendRequest?: (friendId: string) => void;
  onRemoveFriend?: (friendId: string) => void;
  friendRequests?: { incoming: FriendRequest[]; outgoing: FriendRequest[] };
  onAcceptFriendRequest?: (requestId: string) => void;
  onRejectFriendRequest?: (requestId: string) => void;
  onCancelFriendRequest?: (requestId: string) => void;
  onOpenSolitaire?: () => void;
  isAdmin?: boolean;
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
  onSendFriendRequest,
  onRemoveFriend,
  friendRequests = { incoming: [], outgoing: [] },
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onCancelFriendRequest,
  onOpenSolitaire,
  isAdmin = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSearchResult, setFriendSearchResult] = useState<typeof nonFriends | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<User | null>(null);

  // Filter friends (must be in currentUser.friendIds)
  const userFriendIds = currentUser.friendIds || [];
  const friends = users.filter((u) => u.id !== currentUser.id && !u.isOfficial && userFriendIds.includes(u.id));
  const groupRooms = rooms.filter((r) => r.isGroup);

  // 申請中の相手ID集合（送信済み）
  const outgoingPendingIds = new Set(friendRequests.outgoing.map((r) => r.toUserId));
  const userById = (id: string) => users.find((u) => u.id === id);

  const filteredFriends = friends.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.statusMessage && u.statusMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Non-friends available to add
  const nonFriends = users.filter(
    (u) => u.id !== currentUser.id && !u.isOfficial && !userFriendIds.includes(u.id)
  );

  // 検索ボタン押下時のみ完全一致で検索
  const handleFriendSearch = () => {
    const q = friendSearchQuery.trim().toLowerCase();
    if (!q) { setFriendSearchResult([]); return; }
    const result = nonFriends.filter((u) => u.name.toLowerCase() === q);
    setFriendSearchResult(result);
  };

  const handleCloseFriendModal = () => {
    setIsAddFriendModalOpen(false);
    setFriendSearchQuery('');
    setFriendSearchResult(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Top Bar */}
      <div className="sticky top-0 bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between z-10">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">ホーム</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddFriendModalOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-700 transition"
            title="友達申請"
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

        {/* 友達申請（受信）*/}
        {isLoggedIn && friendRequests.incoming.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 px-1">
              <Bell className="w-3.5 h-3.5" />
              <span>新しい友達申請</span>
              <span className="min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {friendRequests.incoming.length}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-emerald-200/80 divide-y divide-slate-100 overflow-hidden shadow-sm">
              {friendRequests.incoming.map((req) => {
                const sender = userById(req.fromUserId);
                return (
                  <div key={req.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={sender?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.fromUserId}`}
                        alt={sender?.name || req.fromUserId}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {sender?.name || '不明なユーザー'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          あなたに友達申請しました
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onAcceptFriendRequest && onAcceptFriendRequest(req.id)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1"
                        title="承認"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>承認</span>
                      </button>
                      <button
                        onClick={() => onRejectFriendRequest && onRejectFriendRequest(req.id)}
                        className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-500 rounded-xl transition"
                        title="拒否"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 送信済みの友達申請 */}
        {isLoggedIn && friendRequests.outgoing.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 px-1">
              <Clock className="w-3.5 h-3.5" />
              <span>申請中</span>
              <span className="text-slate-400 font-normal">{friendRequests.outgoing.length}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-sm">
              {friendRequests.outgoing.map((req) => {
                const target = userById(req.toUserId);
                return (
                  <div key={req.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={target?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.toUserId}`}
                        alt={target?.name || req.toUserId}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {target?.name || '不明なユーザー'}
                        </div>
                        <div className="text-[10px] text-amber-600 mt-0.5">承認待ち</div>
                      </div>
                    </div>
                    <button
                      onClick={() => onCancelFriendRequest && onCancelFriendRequest(req.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition"
                    >
                      取消
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Quick Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setIsAddFriendModalOpen(true)}
            className="p-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/70 rounded-xl flex items-center gap-2.5 transition text-left"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-950">友達申請</div>
              <div className="text-[10px] text-emerald-700 font-medium">IDで検索して申請</div>
            </div>
          </button>

          {!isLoggedIn ? (
            <button
              onClick={() => onOpenAuthModal && onOpenAuthModal('register')}
              className="p-3 bg-teal-50 hover:bg-teal-100/80 border border-teal-200/70 rounded-xl flex items-center gap-2.5 transition text-left"
            >
              <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-teal-950">新規会員登録</div>
                <div className="text-[10px] text-teal-700 font-medium">アカウントを作成</div>
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenProfileSettings}
              className="p-3 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl flex items-center gap-2.5 transition text-left"
            >
              <div className="w-9 h-9 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">プロフィール編集</div>
                <div className="text-[10px] text-slate-600 font-medium">登録情報を変更</div>
              </div>
            </button>
          )}
        </div>

        {/* ソリティアボタン */}
        <button
          onClick={onOpenSolitaire}
          className="w-full p-3 bg-emerald-950/10 hover:bg-emerald-950/20 border border-emerald-800/25 rounded-xl flex items-center gap-2.5 transition text-left"
        >
          <div className="w-9 h-9 rounded-full bg-emerald-900 text-white flex items-center justify-center shrink-0 shadow-sm text-lg font-black">
            ♠
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">ソリティア</div>
            <div className="text-[10px] text-slate-500 font-medium">カードゲームを起動</div>
          </div>
        </button>

        {/* Friends List */}
        {isLoggedIn ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span>友達</span>
              <span className="text-slate-400 font-normal">{filteredFriends.length} 人</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-sm">
              {filteredFriends.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-3">
                  <p className="font-bold text-slate-700">登録されている友達はいません (0人)</p>
                  <p className="text-[11px] text-slate-400">「友達追加」から他のユーザーを検索して友達に追加できます。</p>
                  <button
                    onClick={() => setIsAddFriendModalOpen(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-xs inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>友達を追加・検索する</span>
                  </button>
                </div>
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
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (room) {
                              onOpenChat(room.id);
                            } else {
                              onOpenNewChatModal();
                            }
                          }}
                          title="トークを開く"
                          className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-emerald-600 transition"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFriendToRemove(friend);
                          }}
                          title="友達解除"
                          className="p-2 hover:bg-rose-50 rounded-full text-slate-400 hover:text-rose-500 transition"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
              <span>友達</span>
              <span className="text-slate-400 font-normal">-</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm p-6 text-center text-xs text-slate-500 space-y-3">
              <p className="font-bold text-slate-700">ログインすると友達を確認できます</p>
              <p className="text-[11px] text-slate-400">アカウントにログイン・登録後、追加した友達が一覧で表示されます。</p>
            </div>
          </div>
        )}

        {/* Remove Friend Confirm Modal */}
        {friendToRemove && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mx-auto">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">友達登録を解除しますか？</h3>
                <p className="text-xs text-slate-500 mt-1">
                  「<span className="font-bold text-slate-700">{friendToRemove.name}</span>」さんを友達リストから削除します。
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setFriendToRemove(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    if (onRemoveFriend) {
                      onRemoveFriend(friendToRemove.id);
                    }
                    setFriendToRemove(null);
                  }}
                  className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition shadow-xs"
                >
                  解除する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 管理者用: 全ユーザー一覧 */}
        {isAdmin && isLoggedIn && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 px-1">
              <Shield className="w-3.5 h-3.5" />
              <span>管理者ビュー · 全ユーザー ({users.filter(u => u.id !== currentUser.id).length}人)</span>
            </div>
            <div className="bg-white rounded-2xl border border-purple-200 divide-y divide-slate-100 overflow-hidden shadow-sm">
              {users.filter(u => u.id !== currentUser.id).map((u) => (
                <div key={u.id} className="p-3 flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    {u.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs truncate">{u.name}</span>
                      {(u as any).isAdmin && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded">管理者</span>
                      )}
                      {u.isSuspended && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">停止中</span>
                      )}
                      {userFriendIds.includes(u.id) && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded">友達</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{u.statusMessage || 'ステータスなし'}</div>
                  </div>
                  <div className="text-[10px] text-slate-400 shrink-0">{u.isOnline ? 'オンライン' : 'オフライン'}</div>
                </div>
              ))}
              {users.filter(u => u.id !== currentUser.id).length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400">登録ユーザーなし</div>
              )}
            </div>
          </div>
        )}

        {/* Add Friend Modal */}
        {isAddFriendModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-bold text-base text-slate-900">友達申請</h2>
                <button
                  onClick={handleCloseFriendModal}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-slate-50 border-b border-slate-200/80">
                <p className="text-[11px] text-slate-500 mb-2">ユーザー名を正確に入力して検索してください</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={friendSearchQuery}
                      onChange={(e) => { setFriendSearchQuery(e.target.value); setFriendSearchResult(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleFriendSearch()}
                      placeholder="ユーザー名を入力"
                      className="w-full bg-white border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <button
                    onClick={handleFriendSearch}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition"
                  >
                    検索
                  </button>
                </div>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {friendSearchResult === null ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    ユーザー名を入力して「検索」を押してください
                  </div>
                ) : friendSearchResult.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    「{friendSearchQuery}」に一致するユーザーが見つかりません
                  </div>
                ) : (
                  <div className="space-y-3">
                    {friendSearchResult.map((user) => {
                      const isPending = outgoingPendingIds.has(user.id);
                      return (
                        <div
                          key={user.id}
                          className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{user.name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                {user.statusMessage || `ユーザー`}
                              </div>
                            </div>
                          </div>
                          {isPending ? (
                            <span className="px-3 py-1.5 bg-amber-100 text-amber-700 font-bold text-xs rounded-xl flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>申請中</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                if (onSendFriendRequest) onSendFriendRequest(user.id);
                              }}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>友達申請</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Groups */}
        {isLoggedIn && groupRooms.length > 0 && (
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
