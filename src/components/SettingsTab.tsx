import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, RefreshCw, Zap, ShieldCheck, LogIn, LogOut, KeyRound } from 'lucide-react';

interface SettingsTabProps {
  currentUser: User;
  accountEmail?: string;
  onUpdateProfile: (name: string, statusMessage: string, avatar: string) => void;
  onResetDatabase: () => void;
  onOpenAuthModal: (mode?: 'login' | 'register' | 'forgot') => void;
  onLogout: () => void;
  isConnected: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  accountEmail,
  onUpdateProfile,
  onResetDatabase,
  onOpenAuthModal,
  onLogout,
  isConnected,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [statusMessage, setStatusMessage] = useState(currentUser.statusMessage || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(name, statusMessage, avatar);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200/80 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">設定・プロフィール</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* Account Authentication Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>アカウント認証</span>
          </h2>

          {accountEmail ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold text-emerald-900">ログイン中</p>
                  <p className="text-emerald-700 font-mono mt-0.5">{accountEmail}</p>
                </div>
                <button
                  onClick={() => onOpenAuthModal('forgot')}
                  className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 text-[11px] font-medium rounded-lg hover:bg-emerald-100 transition flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  パスワード変更
                </button>
              </div>

              <button
                onClick={onLogout}
                className="w-full py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-xs rounded-xl transition border border-slate-200 flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                ログアウト
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                アカウントを作成すると、メールアドレスとパスワードでログインし、自分のプロフィールやチャット履歴を保護できます。
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => onOpenAuthModal('login')}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  ログイン
                </button>
                <button
                  onClick={() => onOpenAuthModal('register')}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  新規登録
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Edit Form */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-500" />
            <span>プロフィール編集</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">名前</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-100 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ステータスメッセージ</label>
              <input
                type="text"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="一言メッセージを入力"
                className="w-full bg-slate-100 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">アイコン画像 URL</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full bg-slate-100 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-xs"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {savedSuccess ? (
                <span className="text-xs text-emerald-600 font-bold">✓ 保存しました</span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-sm"
              >
                プロフィール変更を保存
              </button>
            </div>
          </form>
        </div>

        {/* Real-time Technical Specs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>リアルタイム技術スペック</span>
          </h2>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <span className="font-medium">通信プロトコル:</span>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                WebSocket (双方向通信)
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <span className="font-medium">接続ステータス:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  isConnected
                    ? 'text-emerald-700 bg-emerald-100'
                    : 'text-red-700 bg-red-100'
                }`}
              >
                {isConnected ? '接続完了 (Online)' : '再接続待ち...'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <span className="font-medium">メッセージ保存DB:</span>
              <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                永続型ファイル・インメモリDB
              </span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <span className="font-medium">AI公式アカウント機能:</span>
              <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                Gemini API
              </span>
            </div>
          </div>
        </div>

        {/* Database Management */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-slate-600" />
            <span>データリセット</span>
          </h2>
          <p className="text-xs text-slate-500">
            初期状態の友達リスト・トーク履歴データにリセットします。
          </p>
          <button
            onClick={onResetDatabase}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200"
          >
            初期シードデータに戻す
          </button>
        </div>
      </div>
    </div>
  );
};
