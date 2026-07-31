import React, { useState } from 'react';
import { User } from '../types';
import { X, LogIn, KeyRound, Mail, Lock, AlertCircle } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialMode?: Mode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Simple safe JSON helper
  const safeJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      const text = await res.text().catch(() => '');
      return { __raw__: true, error: text || '不明なエラー' };
    }
  };

  // Login handler (wired to backend)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || 'ログインに失敗しました');
      onSuccess(data.user);
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // Register handler: safe stub so UI never breaks; can be wired later
  const handleRegister = async (_e: React.FormEvent) => {
    _e.preventDefault();
    setError('この機能は現在準備中です。管理者に連絡してください。');
  };

  // Forgot password: safe stub
  const handleForgotPassword = async (_e: React.FormEvent) => {
    _e.preventDefault();
    setError('この機能は現在準備中です。管理者に連絡してください。');
  };

  // Reset password: safe stub
  const handleResetPassword = async (_e: React.FormEvent) => {
    _e.preventDefault();
    setError('この機能は現在準備中です。管理者に連絡してください。');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white text-center">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition">
            <X className="w-4 h-4" />
          </button>

          <div className="mx-auto mb-2 w-10 h-10 flex items-center justify-center rounded-xl bg-white/20">
            {mode === 'login' && <LogIn className="w-5 h-5 text-white" />}
            {(mode === 'forgot' || mode === 'reset') && <KeyRound className="w-5 h-5 text-white" />}
          </div>

          <h2 className="text-lg font-semibold">
            {mode === 'login' && 'LINE アカウント ログイン'}
            {mode === 'register' && '新規アカウント登録'}
            {mode === 'forgot' && 'パスワードをお忘れの方'}
            {mode === 'reset' && '新しいパスワードの設定'}
          </h2>

          <p className="text-[10px] text-emerald-100 mt-0.5">
            {mode === 'login' && 'メールアドレスとパスワードでログインしてください'}
            {mode === 'register' && 'アカウントを作成し、LINE AIStudio を利用できます'}
            {mode === 'forgot' && '登録したメールアドレスに再設定コードを送信します'}
            {mode === 'reset' && '受取ったコードと新しいパスワードを入力してください'}
          </p>
        </div>

        {/* Body */}
        <div className="p-4">
          {error && (
            <div className="mb-3 flex items-start gap-2 text-[10px] p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">メールアドレス</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@line.app"
                    className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">パスワード</label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(null); }}
                    className="text-[10px] text-emerald-600 hover:underline"
                  >
                    パスワードをお忘れですか？
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition disabled:opacity-50 mt-1"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>

              <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] text-slate-500">
                  アカウントをお持ちでないですか？{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(null); }}
                    className="text-emerald-600 font-semibold hover:underline"
                  >
                    新規登録はこちら
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* REGISTER (UI only; behavior via stub) */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">メールアドレス</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@line.app"
                    className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition mt-1"
              >
                登録（準備中）
              </button>

              <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-medium"
                >
                  ログイン画面に戻る
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD (stub) */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">メールアドレス</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@line.app"
                    className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition mt-1"
              >
                再設定コードを発行（準備中）
              </button>

              <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-medium"
                >
                  ログイン画面に戻る
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD (stub) */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">新しいパスワード</label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition mt-1"
              >
                パスワードを変更（準備中）
              </button>

              <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-medium"
                >
                  ログイン画面に戻る
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;