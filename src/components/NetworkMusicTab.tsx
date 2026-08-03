import React from 'react';
import { Music, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Folder, ChevronLeft } from 'lucide-react';
import { useMusicPlayer } from '../contexts/MusicPlayerContext';

interface Props { onGoHome?: () => void; }

export const NetworkMusicTab: React.FC<Props> = ({ onGoHome }) => {
  const {
    currentDir, dirHistory, musicItems, musicLoading, musicError,
    currentTrack, isPlaying, isShuffle, setIsShuffle, isLoop, setIsLoop,
    browseDir, handleBrowseDir, handleDirBack, handlePlayTrack, handlePlayPause, handleNext, handlePrev,
  } = useMusicPlayer();

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-800 flex-shrink-0">
        <button onClick={onGoHome} className="text-teal-300 hover:text-teal-200 transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Music className="w-4 h-4 text-teal-400" />
        <h1 className="font-bold text-slate-100 text-base">音楽ネット再生</h1>
      </div>

      <div className="px-4 py-4 border-b border-slate-700/60 bg-slate-800/50 flex-shrink-0">
        <p className="font-bold text-slate-100 text-sm text-center truncate mb-0.5">
          {currentTrack ? currentTrack.name : '曲が選択されていません'}
        </p>
        <p className="text-[10px] text-slate-500 text-center truncate mb-4">
          {currentTrack ? currentTrack.path : 'ファイルをタップして再生'}
        </p>
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setIsShuffle((v: boolean) => !v)} className={`transition ${isShuffle ? 'text-teal-400' : 'text-slate-500'}`}>
            <Shuffle className="w-4 h-4" />
          </button>
          <button onClick={handlePrev} className="text-slate-300 hover:text-white transition">
            <SkipBack className="w-6 h-6" />
          </button>
          <button onClick={handlePlayPause}
            className="w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center shadow-lg transition">
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          <button onClick={handleNext} className="text-slate-300 hover:text-white transition">
            <SkipForward className="w-6 h-6" />
          </button>
          <button onClick={() => setIsLoop((v: boolean) => !v)} className={`transition ${isLoop ? 'text-teal-400' : 'text-slate-500'}`}>
            <Repeat className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/30 border-b border-slate-700/40 flex-shrink-0">
          {dirHistory.length > 0 && (
            <button onClick={handleDirBack} className="text-teal-400 text-xs font-bold hover:text-teal-300 transition">← 戻る</button>
          )}
          <Folder className="w-3 h-3 text-teal-400 flex-shrink-0" />
          <span className="text-xs text-slate-400 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {currentDir || '/ (ルート)'}
          </span>
          {musicLoading && <span className="text-xs text-slate-500">読込中...</span>}
          {musicError && !musicLoading && (
            <button onClick={() => browseDir(currentDir)} className="text-red-400 text-xs hover:text-red-300 transition">再試行</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {musicError && !musicLoading && (
            <div className="p-4 text-red-400 text-xs text-center">接続エラー: {musicError}</div>
          )}
          {!musicError && musicItems.map((item: any) => (
            <div key={item.path}
              onClick={() => item.isDir ? handleBrowseDir(item.path) : handlePlayTrack(item)}
              className={`flex items-center gap-3 px-3 py-3 border-b border-slate-800 cursor-pointer transition active:bg-slate-700 ${currentTrack?.path === item.path ? 'bg-teal-900/30' : 'hover:bg-slate-800'}`}
            >
              <span className="text-base flex-shrink-0">{item.isDir ? '📁' : '🎵'}</span>
              <span className={`text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${item.isDir ? 'text-teal-200' : 'text-slate-200'}`}>
                {item.name}
              </span>
              {!item.isDir && currentTrack?.path === item.path && isPlaying && (
                <span className="text-teal-400 text-xs">▶</span>
              )}
            </div>
          ))}
          {!musicLoading && !musicError && musicItems.length === 0 && (
            <div className="p-6 text-slate-500 text-xs text-center">ファイルなし</div>
          )}
        </div>
      </div>
    </div>
  );
};
