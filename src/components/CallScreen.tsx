import React, { useState, useEffect } from 'react';
import { CallState } from '../types';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, Camera } from 'lucide-react';

interface CallScreenProps {
  callState: CallState;
  onEndCall: () => void;
}

export const CallScreen: React.FC<CallScreenProps> = ({ callState, onEndCall }) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60).toString().padStart(2, '0');
    const secs = (sec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6 animate-in fade-in duration-300">
      {/* Call Header */}
      <div className="flex flex-col items-center mt-8 space-y-2 text-center">
        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full">
          {callState.type === 'video' ? 'LINE ビデオ通話' : 'LINE 無料通話'}
        </span>
        <h2 className="text-2xl font-bold tracking-tight mt-2">{callState.contactName}</h2>
        <p className="text-xs text-slate-400 font-mono">{formatDuration(seconds)}</p>
      </div>

      {/* Center Avatar / Ringing Animation */}
      <div className="relative flex items-center justify-center my-auto">
        <div className="absolute w-44 h-44 rounded-full border-2 border-emerald-500/30 animate-ping" />
        <div className="absolute w-36 h-36 rounded-full border border-emerald-500/40 animate-pulse" />
        <img
          src={callState.contactAvatar}
          alt={callState.contactName}
          className="w-28 h-28 rounded-full object-cover border-4 border-slate-800 shadow-2xl relative z-10"
        />
      </div>

      {/* Call Controls */}
      <div className="w-full max-w-xs mb-8 flex flex-col gap-6 items-center">
        <div className="flex items-center justify-around w-full">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full transition ${
              isMuted ? 'bg-slate-700 text-red-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="マイク切り替え"
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-4 rounded-full transition ${
              isSpeakerOn ? 'bg-slate-800 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}
            title="スピーカー"
          >
            {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>

          {callState.type === 'video' && (
            <button className="p-4 bg-slate-800 text-slate-200 rounded-full hover:bg-slate-700 transition">
              <Camera className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          className="w-16 h-16 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition hover:scale-105 active:scale-95"
          title="通話を終了"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
