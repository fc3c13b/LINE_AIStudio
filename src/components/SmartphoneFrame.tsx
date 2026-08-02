import React from 'react';

interface SmartphoneFrameProps {
  children: React.ReactNode;
  isConnected: boolean;
  activeTabTitle?: string;
}

export const SmartphoneFrame: React.FC<SmartphoneFrameProps> = ({
  children,
  isConnected,
}) => {
  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans selection:bg-[#00c300] selection:text-white">
      {/* 接続インジケーター: 左上に小さく表示 */}
      <div className="absolute top-1 left-1 z-50 flex items-center gap-1 px-1.5 py-0.5 bg-white/80 backdrop-blur-xs rounded-full border border-slate-200/60 shadow-xs">
        <div className={`w-2 h-2 rounded-full transition-colors ${
          isConnected ? 'bg-[#00c300] animate-pulse' : 'bg-slate-400'
        }`} />
        <span className={`text-[9px] font-bold ${isConnected ? 'text-[#00c300]' : 'text-slate-400'}`}>
          {isConnected ? 'NAS接続中' : '未接続'}
        </span>
      </div>

      {/* App Body — フル画面 */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {children}
      </div>
    </div>
  );
};
