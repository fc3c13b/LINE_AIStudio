import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Music, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Folder, ChevronLeft } from 'lucide-react';
import { apiUrl } from '../services/api';

interface SmbItem { name: string; path: string; isAudio: boolean; isDir: boolean; ext: string; }

interface Props {
  onGoHome?: () => void;
}

export const NetworkMusicTab: React.FC<Props> = ({ onGoHome }) => {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const audioRef = useRef<HTMLAudioElement>(null);

  const load = <T,>(key: string, fallback: T): T => {
    try { return (JSON.parse(localStorage.getItem('music_state') || '{}') as any)[key] ?? fallback; }
    catch { return fallback; }
  };

  const [currentDir, setCurrentDir] = useState(() => load<string>('currentDir', ''));
  const [dirHistory, setDirHistory] = useState(() => load<string[]>('dirHistory', []));
  const [musicItems, setMusicItems] = useState(() => load<SmbItem[]>('musicItems', []));
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [playlist, setPlaylist] = useState(() => load<SmbItem[]>('playlist', []));
  const [playlistIdx, setPlaylistIdx] = useState(() => load<number>('playlistIdx', -1));
  const [currentTrack, setCurrentTrack] = useState(() => load<SmbItem | null>('currentTrack', null));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(() => load<boolean>('isShuffle', false));
  const [isLoop, setIsLoop] = useState(() => load<boolean>('isLoop', false));

  const browseDir = useCallback(async (dir: string) => {
    setMusicLoading(true);
    setMusicError('');
    try {
      const res = await fetch(apiUrl(`/api/music/browse?path=${encodeURIComponent(dir)}`));
      const data = await res.json();
      if (data.success) {
        setMusicItems(data.items);
        setCurrentDir(dir);
        setPlaylist(data.items.filter((i: SmbItem) => i.isAudio));
      } else {
        setMusicError(data.error || 'エラー');
      }
    } catch (err: any) {
      setMusicError(err.message || '接続失敗');
    } finally {
      setMusicLoading(false);
    }
  }, []);

  const handleBrowseDir = (dir: string) => {
    setDirHistory(h => [...h, currentDir]);
    browseDir(dir);
  };

  const handleDirBack = () => {
    setDirHistory(h => {
      const prev = [...h];
      const target = prev.pop() ?? '';
      browseDir(target);
      return prev;
    });
  };

  const playTrackAt = useCallback((item: SmbItem, idx: number) => {
    setCurrentTrack(item);
    setPlaylistIdx(idx);
    if (audioRef.current) {
      audioRef.current.src = apiUrl(`/api/music/stream?path=${encodeURIComponent(item.path)}`);
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, []);

  const handlePlayTrack = (item: SmbItem) => {
    const idx = playlist.findIndex(p => p.path === item.path);
    playTrackAt(item, idx >= 0 ? idx : 0);
  };

  const handlePlayPause = () => {
    if (!currentTrack) {
      if (playlist.length > 0) playTrackAt(playlist[0], 0);
      return;
    }
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); }
  };

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return;
    const idx = isShuffle ? Math.floor(Math.random() * playlist.length) : (playlistIdx + 1) % playlist.length;
    playTrackAt(playlist[idx], idx);
  }, [playlist, playlistIdx, isShuffle, playTrackAt]);

  const handlePrev = useCallback(() => {
    if (playlist.length === 0) return;
    const idx = playlistIdx <= 0 ? playlist.length - 1 : playlistIdx - 1;
    playTrackAt(playlist[idx], idx);
  }, [playlist, playlistIdx, playTrackAt]);

  const handleTrackEnded = useCallback(() => {
    if (isLoop && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => setIsPlaying(false)); }
    else { handleNext(); }
  }, [isLoop, handleNext]);

  useEffect(() => { if (musicItems.length === 0 && !musicLoading) browseDir(''); }, []);

  useEffect(() => {
    if (currentTrack && audioRef.current && !audioRef.current.src)
      audioRef.current.src = apiUrl(`/api/music/stream?path=${encodeURIComponent(currentTrack.path)}`);
  }, []);

  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem('music_state', JSON.stringify({
          currentTrack, playlist, playlistIdx, currentDir, musicItems, isShuffle, isLoop, dirHistory,
        }));
      } catch {}
    }, 1000);
    return () => clearTimeout(saveTimerRef.current);
  }, [currentTrack, playlist, playlistIdx, currentDir, musicItems, isShuffle, isLoop, dirHistory]);

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60 bg-slate-800 flex-shrink-0">
        <button onClick={onGoHome} className="text-teal-300 hover:text-teal-200 transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Music className="w-4 h-4 text-teal-400" />
        <h1 className="font-bold text-slate-100 text-base">音楽ネット再生</h1>
      </div>

      {/* 再生コントロール */}
      <div className="px-4 py-4 border-b border-slate-700/60 bg-slate-800/50 flex-shrink-0">
        <p className="font-bold text-slate-100 text-sm text-center truncate mb-0.5">
          {currentTrack ? currentTrack.name : '曲が選択されていません'}
        </p>
        <p className="text-[10px] text-slate-500 text-center truncate mb-4">
          {currentTrack ? currentTrack.path : 'ファイルをタップして再生'}
        </p>
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setIsShuffle(v => !v)} className={`transition ${isShuffle ? 'text-teal-400' : 'text-slate-500'}`}>
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
          <button onClick={() => setIsLoop(v => !v)} className={`transition ${isLoop ? 'text-teal-400' : 'text-slate-500'}`}>
            <Repeat className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* フォルダブラウザ */}
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
          {!musicError && musicItems.map(item => (
            <div
              key={item.path}
              onClick={() => item.isDir ? handleBrowseDir(item.path) : handlePlayTrack(item)}
              className={`flex items-center gap-3 px-3 py-3 border-b border-slate-800 cursor-pointer transition active:bg-slate-700 ${
                currentTrack?.path === item.path ? 'bg-teal-900/30' : 'hover:bg-slate-800'
              }`}
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

      <audio ref={audioRef} onEnded={handleTrackEnded} style={{ display: 'none' }} />
    </div>
  );
};
