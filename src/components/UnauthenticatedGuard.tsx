import React from 'react';
import { MessageSquare, Lock, LogIn, UserPlus, ShieldCheck } from 'lucide-react';

interface UnauthenticatedGuardProps {
  onOpenAuthModal: (mode: 'login' | 'register') => void;
}

export const UnauthenticatedGuard: React.FC<UnauthenticatedGuardProps> = ({ onOpenAuthModal }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-emerald-50 via-white to-slate-50 text-center h-full relative overflow-y-auto">
      <div className="w-20 h-20 bg-gradient-to-tr from-[#00c300] to-emerald-400 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-5 relative animate-in zoom-in-90 duration-300">
        <MessageSquare className="w-10 h-10 fill-white/20" />
        <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-md text-slate-700">
          <Lock className="w-4 h-4 text-emerald-600" />
        </div>
      </div>

      <h1 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">LINE AI Studio</h1>
      <p className="text-xs text-slate-500 max-w-xs mb-8 leading-relaxed">
        トーク内容やアルバム、機能をご利用いただくにはログインが必要です。
      </p>

      <div className="w-full max-w-xs space-y-3.5 mb-8">
        <button
          type="button"
          onClick={() => onOpenAuthModal('login')}
          className="w-full py-3 bg-[#00c300] hover:bg-[#00b300] active:scale-[0.98] text-white font-bold rounded-2xl shadow-md shadow-emerald-500/20 transition text-sm flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          ログインする
        </button>

        <button
          type="button"
          onClick={() => onOpenAuthModal('register')}
          className="w-full py-3 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-bold border border-slate-200 rounded-2xl shadow-sm transition text-sm flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4 text-emerald-600" />
          新規アカウントを作成
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-100/80 px-3 py-1.5 rounded-full">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>ログイン前はチャットやアルバムは非公開です</span>
      </div>
    </div>
  );
};
