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
      {/* 接続インジケーター: 左上に小さく表示（文字なし、点のみ） */}
      <div className="absolute top-1.5 left-1.5 z-50">
        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
          isConnected ? 'bg-[#00c300] animate-ping' : 'bg-slate-400'
        }`} />
      </div>

      {/* App Body — フル画面 */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {children}
      </div>
    </div>
  );
};
