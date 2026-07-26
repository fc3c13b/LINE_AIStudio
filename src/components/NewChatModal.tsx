import React, { useState } from 'react';
import { User } from '../types';
import { X, Users, UserPlus, Sparkles, Check } from 'lucide-react';

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
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const availableFriends = users.filter((u) => u.id !== currentUser.id);

  const toggleUserSelection = (id: string) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter((item) => item !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;

    if (isGroupMode) {
      const name = groupName.trim() || '新規グループ';
      onCreateRoom(name, selectedUserIds, true);
    } else {
      const friend = availableFriends.find((u) => u.id === selectedUserIds[0]);
      onCreateRoom(friend?.name || 'トーク', selectedUserIds, false);
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-base text-slate-900">
            {isGroupMode ? '新規グループ作成' : '新規トーク'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setIsGroupMode(false);
              setSelectedUserIds([]);
            }}
            className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition ${
              !isGroupMode ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            1対1 トーク
          </button>
          <button
            type="button"
            onClick={() => {
              setIsGroupMode(true);
              setSelectedUserIds([]);
            }}
            className={`flex-1 py-1.5 rounded-xl font-bold text-xs transition ${
              isGroupMode ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            グループ作成
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {isGroupMode && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">グループ名</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="グループ名を入力"
                className="w-full bg-slate-100 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {isGroupMode ? 'メンバーを選択' : '相手を選択'}
            </label>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableFriends.map((friend) => {
                const isSelected = selectedUserIds.includes(friend.id);
                return (
                  <div
                    key={friend.id}
                    onClick={() => {
                      if (isGroupMode) {
                        toggleUserSelection(friend.id);
                      } else {
                        setSelectedUserIds([friend.id]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                          <span>{friend.name}</span>
                          {friend.isOfficial && (
                            <span className="px-1 py-0.2 bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded">
                              AI
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">{friend.statusMessage}</p>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={selectedUserIds.length === 0}
            className={`w-full py-2.5 font-bold text-xs rounded-xl transition shadow-sm ${
              selectedUserIds.length > 0
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isGroupMode ? `グループを作成 (${selectedUserIds.length}名)` : 'トークを開始'}
          </button>
        </form>
      </div>
    </div>
  );
};
