import React, { useState } from 'react';
import { User } from '../types';
import { X, UserPlus, LogIn, User as UserIcon, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiUrl, readApiResponse } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, accountInfo?: { id: string; name: string; isAdmin?: boolean }) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  // Status & error states
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    resetMessages();
  };

  // 1. Login Submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await readApiResponse<any>(res);

      if (!res.ok) {
        throw new Error(data.error || 'ログインに失敗しました');
      }

      onSuccess(data.user, data.account);
      onClose();
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Register Submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await readApiResponse<any>(res);

      if (!res.ok) {
        throw new Error(data.error || 'アカウント登録に失敗しました');
      }

      setSuccessMessage('アカウントが正常に登録されました！');
      setTimeout(() => {
        onSuccess(data.user, data.account);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-all">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-12 mx-auto mb-3 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            {mode === 'login' && <LogIn className="w-6 h-6 text-white" />}
            {mode === 'register' && <UserPlus className="w-6 h-6 text-white" />}
          </div>
          
          <h2 className="text-xl font-bold">
            {mode === 'login' && 'LINE アカウント ログイン'}
            {mode === 'register' && '新規アカウント登録'}
          </h2>
          <p className="text-xs text-emerald-100 mt-1">
            {mode === 'login' && 'ユーザー名とパスワードでログインしてください'}
            {mode === 'register' && 'ユーザー名とパスワードを入力'}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* Error / Success Notifications */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ユーザー名
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例: 山田 太郎"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    パスワード
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-emerald-500/20 transition disabled:opacity-50 mt-2"
              >
                {isLoading ? 'ログイン中...' : 'ログイン'}
              </button>

              <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  アカウントをお持ちでないですか？{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    新規登録はこちら
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE 2: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ユーザー名 (LINE表示名)
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例: 山田 太郎"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  パスワード (4文字以上)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-emerald-500/20 transition disabled:opacity-50 mt-2"
              >
                {isLoading ? 'アカウント作成中...' : 'アカウントを作成する'}
              </button>

              <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  既にアカウントをお持ちですか？{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    ログインはこちら
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
