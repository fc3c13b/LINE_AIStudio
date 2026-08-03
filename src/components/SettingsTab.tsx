import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import {
  UserCheck,
  RefreshCw,
  ShieldCheck,
  LogOut,
  Lock,
  Shield,
  UserX,
  UserCheck2,
  Trash2,
  AlertTriangle,
  MessageSquare,
  ChevronLeft,
  KeyRound,
} from 'lucide-react';
import { apiUrl } from '../services/api';

export interface ChatSettings {
  fontSize: number;        // px: 8-18
  bubbleBorderRadius: number; // px: 0-20 吸い出し角丸さ
  bubbleBorderWidth: number;  // px: 0-4  吸い出し縁取り幅
  maxPhotoHeight: number;  // px: 60-300
  timestampSize: number;   // px: 5-14
  chatInterval: number;    // px: 2-16  吸い出し間隔
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  fontSize: 12,
  bubbleBorderRadius: 12,
  bubbleBorderWidth: 0,
  maxPhotoHeight: 160,
  timestampSize: 9,
  chatInterval: 6,
};

interface SettingsTabProps {
  currentUser: User;
  accountEmail?: string;
  accountId?: string;
  isLoggedIn?: boolean;
  isAdmin?: boolean;
  chatSettings: ChatSettings;
  onChatSettingsChange: (s: ChatSettings) => void;
  onUpdateProfile: (name: string, statusMessage: string, avatar: string) => void;
  onResetDatabase: () => void;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
  onLockApp?: () => void;
  isConnected: boolean;
  onGoHome?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  currentUser,
  accountEmail,
  accountId,
  isLoggedIn = false,
  isAdmin = false,
  chatSettings,
  onChatSettingsChange,
  onUpdateProfile,
  onResetDatabase,
  onOpenAuthModal,
  onLogout,
  onLockApp,
  isConnected,
  onGoHome,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [statusMessage, setStatusMessage] = useState(currentUser.statusMessage || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // サブパスワード設定用
  const [subPwCurrent, setSubPwCurrent] = useState('');
  const [subPwNew, setSubPwNew] = useState('');
  const [subPwMsg, setSubPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [subPwLoading, setSubPwLoading] = useState(false);

  const handleSetSubPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    setSubPwMsg(null);
    setSubPwLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/set-secondary-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, currentPassword: subPwCurrent, newPassword2: subPwNew || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '失敗しました');
      setSubPwMsg({ type: 'ok', text: data.message });
      setSubPwCurrent('');
      setSubPwNew('');
    } catch (err: any) {
      setSubPwMsg({ type: 'err', text: err.message });
    } finally {
      setSubPwLoading(false);
    }
  };

  // 写真を選択→Canvas で 1:1 クロップ→base64 で avatar に設定
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(
          img,
          (img.width - size) / 2,
          (img.height - size) / 2,
          size,
          size,
          0,
          0,
          200,
          200
        );
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 管理者パネル用
  const [adminUsers, setAdminUsers] = useState<(User & { isAdmin?: boolean })[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (isAdmin) loadAdminUsers();
  }, [isAdmin]);

  const loadAdminUsers = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/users?adminId=${encodeURIComponent(currentUser.id)}`));
      if (res.ok) setAdminUsers(await res.json());
    } catch { /* noop */ }
    finally { setAdminLoading(false); }
  };

  const adminAction = async (action: 'suspend' | 'unsuspend', userId: string) => {
    const method = 'POST';
    const url = apiUrl(`/api/admin/users/${userId}/${action}`);
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: currentUser.id }),
    });
    loadAdminUsers();
  };

  const adminDelete = async (userId: string, userName: string) => {
    if (!confirm(`「${userName}」のアカウントを完全に削除しますか？\nこの操作は取り消せません。`)) return;
    await fetch(apiUrl(`/api/admin/users/${userId}?adminId=${encodeURIComponent(currentUser.id)}`), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: currentUser.id }),
    });
    loadAdminUsers();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(name, statusMessage, avatar);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="px-3 py-3 bg-white border-b border-slate-200/80 sticky top-0 z-10 flex items-center gap-2">
        {onGoHome && (
          <button onClick={onGoHome} className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">設定・プロフィール</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* Account Card */}
        {isLoggedIn && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>アカウント</span>
              {isAdmin && <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">管理者</span>}
            </h2>

            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs">
              <p className="font-semibold text-emerald-900">ログイン中: {currentUser.name}</p>
            </div>

            <div className="flex gap-2">
              {onLockApp && (
                <button
                  onClick={onLockApp}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  今すぐロック
                </button>
              )}
              <button
                onClick={onLogout}
                className="flex-1 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-xs rounded-xl transition border border-slate-200 flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                ログアウト
              </button>
            </div>
          </div>
        )}

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
                placeholder="HELLO WORLD"
                className="w-full bg-slate-100 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">アイコン画像</label>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
              <div className="flex items-center gap-3">
                <img src={avatar} alt="avatar" className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shrink-0" />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition"
                >
                  写真から選ぶ（1:1 自動トリミング）
                </button>
              </div>
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

        {/* 管理者パネル — administrator のみ表示 */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <h2 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>管理者パネル</span>
              </h2>
              <button onClick={loadAdminUsers} className="text-[10px] text-amber-600 hover:underline font-bold">更新</button>
            </div>

            {/* ユーザー管理リスト */}
            <div className="divide-y divide-slate-100">
              {adminLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">読み込み中...</div>
              ) : adminUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">登録ユーザーがいません</div>
              ) : (
                adminUsers.map((u) => (
                  <div key={u.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">{u.name}</span>
                          {u.isSuspended && (
                            <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full border border-red-200">停止中</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate block">{u.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.isSuspended ? (
                        <button
                          onClick={() => adminAction('unsuspend', u.id)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition"
                          title="利用停止を解除"
                        >
                          <UserCheck2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => adminAction('suspend', u.id)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition"
                          title="利用停止"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => adminDelete(u.id, u.name)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition"
                        title="アカウント削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* データリセット（管理者専用） */}
            <div className="p-4 border-t border-amber-100 space-y-2">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span>全データリセット（危険）</span>
              </h3>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="w-full py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 font-bold text-xs rounded-xl transition border border-slate-200"
                >
                  初期シードデータに戻す
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => { onResetDatabase(); setConfirmReset(false); }}
                    className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl"
                  >
                    実行する
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* チャット表示設定 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>チャット表示設定</span>
          </h2>
        {([  
            { key: 'fontSize' as const, label: '文字サイズ', unit: 'px', min: 8, max: 18, step: 1 },
            { key: 'bubbleBorderRadius' as const, label: '吸い出し角丸さ', unit: 'px', min: 0, max: 20, step: 2 },
            { key: 'bubbleBorderWidth' as const, label: '吸い出し縁取り幅', unit: 'px', min: 0, max: 4, step: 1 },
            { key: 'maxPhotoHeight' as const, label: '写真最大縦サイズ', unit: 'px', min: 60, max: 300, step: 10 },
            { key: 'timestampSize' as const, label: '日時サイズ', unit: 'px', min: 5, max: 14, step: 1 },
            { key: 'chatInterval' as const, label: 'チャット間隔', unit: 'px', min: 2, max: 16, step: 2 },
          ]).map(({ key, label, unit, min, max, step }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-28 shrink-0">{label}</span>
              <input
                type="range" min={min} max={max} step={step}
                value={chatSettings[key]}
                onChange={(e) => onChatSettingsChange({ ...chatSettings, [key]: Number(e.target.value) })}
                className="flex-1 accent-[#00c300]"
              />
              <span className="text-xs font-mono text-slate-500 w-12 text-right">{chatSettings[key]}{unit}</span>
            </div>
          ))}
        </div>

        {/* サブパスワード設定 */}
        {isLoggedIn && accountId && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-500" />
              <span>サブパスワード設定</span>
            </h2>
            <p className="text-xs text-slate-500">メインとサブのどちらでもロック解除できます。サブパスワードを削除するには「新しいサブパスワード」を空欄にして保存してください。</p>
            <form onSubmit={handleSetSubPassword} className="space-y-2">
              <input
                type="password"
                required
                placeholder="現在のパスワード（確認）"
                value={subPwCurrent}
                onChange={(e) => setSubPwCurrent(e.target.value)}
                minLength={4}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <input
                type="password"
                placeholder="新しいサブパスワード（空欄で削除）"
                value={subPwNew}
                onChange={(e) => setSubPwNew(e.target.value)}
                minLength={subPwNew ? 4 : undefined}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              {subPwMsg && (
                <p className={`text-xs px-2 py-1 rounded-lg ${subPwMsg.type === 'ok' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                  {subPwMsg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={subPwLoading || !subPwCurrent}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition"
              >
                {subPwLoading ? '保存中...' : 'サブパスワードを保存'}
              </button>
            </form>
          </div>
        )}

        {/* バージョン表示 */}
        <div className="text-center py-3 text-[10px] text-slate-400 font-mono">
          LINE AIStudio v0.7.6
        </div>
      </div>
    </div>
  );
};
