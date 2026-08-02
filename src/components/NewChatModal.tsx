import React from 'react';
import { User } from '../types';
import { X, MessageSquare } from 'lucide-react';

interface NewChatModalProps {
  users: User[];
  currentUser: User;
  onClose: () => void;
  onCreateRoom: (name: string, memberIds: string[], isGroup: boolean) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  users,
  currentUser,
  onClose,
  onCreateRoom,
}) => {
  // 承認済み友達のみ表示（友達申請が通った相手）
  const friends = users.filter(
    (u) => u.id !== currentUser.id && !u.isOfficial && (currentUser.friendIds || []).includes(u.id)
  );

  const startChat = (friend: User) => {
    onCreateRoom(friend.name, [friend.id], false);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-base text-slate-900">新規トーク</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {friends.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">トークを開始できる友達がいません</p>
              <p className="text-[11px] text-slate-400">
                『ホーム』タブから友達申請を送り、承認されると表示されます。
              </p>
            </div>
          ) : (
            friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => startChat(friend)}
                className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-xl transition text-left"
              >
                <div className="relative shrink-0">
                  <img
                    src={friend.avatar}
                    alt={friend.name}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200"
                  />
                  {friend.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{friend.name}</div>
                  <div className="text-xs text-slate-400 truncate">
                    {friend.statusMessage || 'ステータスメッセージなし'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

