import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Wifi, Battery, Signal, Zap } from 'lucide-react';

interface SmartphoneFrameProps {
  children: React.ReactNode;
  isConnected: boolean;
  activeTabTitle?: string;
}

export const SmartphoneFrame: React.FC<SmartphoneFrameProps> = ({
  children,
  isConnected,
  activeTabTitle = 'LINE',
}) => {
  const [isMobileFrame, setIsMobileFrame] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 flex flex-col items-center justify-center p-2 sm:p-4 font-sans selection:bg-[#00c300] selection:text-white">
      {/* Header bar with controls */}
      <header className="w-full max-w-4xl mb-3 flex items-center justify-between px-2 text-xs sm:text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00c300] animate-pulse" />
          <span className="font-bold text-slate-900 tracking-wide">LINE スマフォアプリ</span>
          <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] bg-white border border-slate-200/80 rounded-full text-[#00c300] font-bold shadow-xs">
            {isConnected ? 'WebSocket リアルタイム接続中' : 'WebSocket 接続中...'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileFrame(!isMobileFrame)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-full border border-slate-200 shadow-xs transition text-xs font-semibold"
          >
            {isMobileFrame ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-[#00c300]" />
                <span>ワイド表示</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-[#00c300]" />
                <span>スマホ枠表示</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div
        className={`w-full transition-all duration-300 flex justify-center items-center ${
          isMobileFrame ? 'max-w-[420px]' : 'max-w-4xl'
        }`}
      >
        <div
          className={`w-full bg-slate-900 overflow-hidden shadow-2xl relative ${
            isMobileFrame
              ? 'rounded-[48px] border-[12px] border-slate-900 ring-1 ring-slate-800/20 h-[840px] max-h-[92vh] flex flex-col'
              : 'rounded-2xl border border-slate-800 h-[820px] max-h-[92vh] flex flex-col'
          }`}
        >
          {/* Smartphone Top Notch & Status Bar */}
          {isMobileFrame && (
            <div className="bg-slate-900 text-white px-7 pt-3 pb-1 flex justify-between items-center z-50 select-none">
              <span className="text-xs font-bold tracking-tight text-slate-100">{currentTime || '9:41'}</span>

              {/* Dynamic Island / Notch */}
              <div className="w-24 h-4 bg-black rounded-full border border-slate-800 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#00c300] animate-ping" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              </div>

              <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <Battery className="w-3.5 h-3.5 text-[#00c300] fill-[#00c300]" />
              </div>
            </div>
          )}

          {/* App Body */}
          <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-100 text-slate-900">
            {children}
          </div>

          {/* Smartphone Home Indicator Bar */}
          {isMobileFrame && (
            <div className="bg-slate-950 py-2 flex justify-center items-center z-50">
              <div className="w-32 h-1 bg-slate-700 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
