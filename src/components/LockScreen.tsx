import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  LogOut,
  ShieldAlert,
  ArrowRight,
  KeyRound,
  Mail,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Send,
} from 'lucide-react';
import { User } from '../types';

interface LockScreenProps {
  user: User;
  account: { id: string; name: string; email: string };
  onUnlock: () => void;
  onLogout: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  user,
  account,
  onUnlock,
  onLogout,
}) => {
  const [mode, setMode] = useState<'unlock' | 'forgot_send' | 'forgot_reset'>('unlock');

  // Lock verify state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Forgot password reset state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  // 通常のパスワード照合によるロック解除
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('パスワードを入力してください');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          accountId: account.id,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'パスワードが正しくありません');
      }

      onUnlock();
    } catch (err: any) {
      setError(err.message || '認証エラーが発生しました');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  // 再設定用メール（コード）の送信リクエスト
  const handleSendResetEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'メール送信に失敗しました');
      }

      setInfoMessage(data.message || '登録メールアドレス宛に再設定コードを送信しました');
      if (data.devCode) {
        setDevCode(data.devCode);
        setResetCode(data.devCode); // テスト用に自動補完
      }
      setMode('forgot_reset');
    } catch (err: any) {
      setError(err.message || '送信処理中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 再設定コード認証＆新しいパスワードのセット
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode) {
      setError('再設定コードを入力してください');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('新しいパスワードは6文字以上で入力してください');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          code: resetCode,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'パスワード再設定に失敗しました');
      }

      // 成功した場合、新しいパスワードで更新が完了したため、そのままロック解除！
      onUnlock();
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-between p-6 overflow-y-auto backdrop-blur-md animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-xs text-slate-400 pt-2">
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60 shadow-inner">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium text-slate-300">画面ロック中</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1 text-slate-400 hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800/60"
          title="ログアウト"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>ログアウト</span>
        </button>
      </div>

      {/* Main Content */}
      <div className={`w-full max-w-xs flex flex-col items-center my-auto py-4 ${isShaking ? 'animate-bounce' : ''}`}>
        {/* User Avatar with Status Icon */}
        <div className="relative mb-3">
          <div className="w-18 h-18 w-20 h-20 rounded-full overflow-hidden ring-4 ring-emerald-500/30 shadow-2xl bg-slate-700">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-full shadow-lg ring-2 ring-slate-900">
            {mode === 'unlock' ? (
              <KeyRound className="w-4 h-4" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
          </div>
        </div>

        {/* User Info */}
        <h2 className="text-lg font-bold text-white mb-0.5 tracking-tight">{user.name}</h2>
        <p className="text-xs text-slate-400 mb-5 font-mono">{account.email}</p>

        {/* モード 1: パスワード入力（通常ロック解除） */}
        {mode === 'unlock' && (
          <form onSubmit={handleVerify} className="w-full space-y-3.5">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="登録パスワードを入力"
                disabled={isLoading}
                className="w-full bg-slate-800/90 text-white placeholder-slate-500 text-sm rounded-2xl px-4 py-3.5 pr-11 border border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition shadow-inner"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-xs animate-in fade-in">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/25 transition text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>ロック解除</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMessage(null);
                  setMode('forgot_send');
                }}
                className="text-xs text-slate-400 hover:text-emerald-400 underline underline-offset-4 transition flex items-center justify-center gap-1.5 mx-auto"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>パスワードをお忘れの場合</span>
              </button>
            </div>
          </form>
        )}

        {/* モード 2: パスワード再設定メール（コード）送信案内 */}
        {mode === 'forgot_send' && (
          <div className="w-full space-y-4 animate-in fade-in duration-200">
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Mail className="w-4 h-4" />
                <span>再設定メールの送信</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                登録メールアドレス <span className="font-mono text-emerald-300 font-bold">{account.email}</span> 宛にパスワード再設定用の認証コードを送信します。
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleSendResetEmail()}
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>再設定メール（コード）を飛ばす</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('unlock');
              }}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>通常のロック解除に戻る</span>
            </button>
          </div>
        )}

        {/* モード 3: 再設定コード入力＆新しいパスワード設定 */}
        {mode === 'forgot_reset' && (
          <form onSubmit={handleResetPassword} className="w-full space-y-3.5 animate-in fade-in duration-200">
            {infoMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-xs text-emerald-300 space-y-1 text-left">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>メール（コード）送信完了</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">{infoMessage}</p>
                {devCode && (
                  <div className="mt-1 pt-1 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">発行コード:</span>
                    <span className="font-mono font-bold text-emerald-300 text-xs tracking-wider">{devCode}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 text-left">
                  再設定コード（6桁）
                </label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  placeholder="6桁のコード"
                  maxLength={6}
                  disabled={isLoading}
                  className="w-full bg-slate-800/90 text-white placeholder-slate-500 text-sm rounded-2xl px-4 py-3 border border-slate-700 focus:border-emerald-500 outline-none font-mono tracking-widest text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 text-left">
                  新しいパスワード（6文字以上）
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="新しいパスワード"
                    disabled={isLoading}
                    className="w-full bg-slate-800/90 text-white placeholder-slate-500 text-sm rounded-2xl px-4 py-3 pr-11 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !resetCode || !newPassword}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/25 transition text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>パスワード変更＆ロック解除</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('unlock');
              }}
              className="w-full py-1 text-xs text-slate-400 hover:text-white transition flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>通常のロック解除に戻る</span>
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-slate-500 pb-2">
        <p>画面から離れるとセキュリティのため自動でロックされます</p>
      </div>
    </div>
  );
};
