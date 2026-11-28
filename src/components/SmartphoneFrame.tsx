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
    <div
      className="bg-white text-slate-800 flex flex-col font-sans selection:bg-[#00c300] selection:text-white overflow-hidden"
      style={{
        // Android 15+ Edge-to-Edge 対策（純粋CSS・JS非依存）:
        // 100dvh はシステムバー込みの全画面高さ。box-sizing: border-box と
        // env(safe-area-inset-*) のパディングで、内側のコンテンツ領域を
        // 実際の表示可能領域に一致させる。ブラウザが毎レイアウトで自動再計算するため、
        // 背面復帰・ロック復帰でも確実にフィットする。
        height: '100dvh',
        boxSizing: 'border-box',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* 接続インジケーター: 左上に小さく表示（文字なし、点のみ） */}
      <div className="absolute top-1.5 left-1.5 z-50">
        <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
          isConnected ? 'bg-[#00c300] animate-ping' : 'bg-slate-400'
        }`} />
      </div>

      {/* App Body — フル画面 */}
      <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {children}
      </div>
    </div>
  );
};
