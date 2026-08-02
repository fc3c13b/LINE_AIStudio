import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { User } from '../types';
import { apiUrl, readApiResponse } from '../services/api';

interface LockScreenProps {
  user: User;
  account: { id: string; name: string; email?: string };
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  user,
  account,
  onUnlock,
}) => {
  // Lock verify state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

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
      const res = await fetch(apiUrl('/api/auth/verify-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          password,
        }),
      });

      const data = await readApiResponse<any>(res);

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

  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-between p-6 overflow-y-auto backdrop-blur-md animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-xs text-slate-400 pt-2">
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60 shadow-inner">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium text-slate-300">画面ロック中</span>
        </div>
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
            <KeyRound className="w-4 h-4" />
          </div>
        </div>

        {/* User Info */}
        <h2 className="text-lg font-bold text-white mb-0.5 tracking-tight">{user.name}</h2>
        <p className="text-xs text-slate-400 mb-5">パスワードを入力してロックを解除してください</p>

        <form onSubmit={handleVerify} className="w-full space-y-3.5">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="パスワードを入力"
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
        </form>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-slate-500 pb-2">
        <p>画面から離れるとセキュリティのため自動でロックされます</p>
      </div>
    </div>
  );
};
