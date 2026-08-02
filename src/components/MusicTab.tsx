import React, { useState, useRef, useEffect } from 'react';
import { MusicItem } from '../types';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Edit2,
  Search,
  Check,
  Disc,
  ListMusic,
  Radio,
  FileAudio,
  ChevronLeft,
} from 'lucide-react';

// Sample initial music tracks (empty by default)
const INITIAL_MUSIC_LIST: MusicItem[] = [];

interface MusicTabProps {
  isLoggedIn?: boolean;
  onGoHome?: () => void;
  rooms?: import('../types').ChatRoom[];
  onSendToChat?: (roomId: string, text: string) => void;
}

export const MusicTab: React.FC<MusicTabProps> = ({ onGoHome, rooms = [], onSendToChat }) => {
  // Saved music state from localStorage or initial empty list
  const [musicList, setMusicList] = useState<MusicItem[]>(() => {
    try {
      const saved = localStorage.getItem('line_app_music_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Remove legacy sample tracks if any
          const filtered = parsed.filter(
            (item: MusicItem) => !['music-1', 'music-2', 'music-3'].includes(item.id)
          );
          return filtered;
        }
      }
    } catch (e) {
      console.error('Failed to parse music list:', e);
    }
    return INITIAL_MUSIC_LIST;
  });

  // Save to localStorage when list changes
  useEffect(() => {
    try {
      localStorage.setItem('line_app_music_list', JSON.stringify(musicList));
    } catch (e) {
      console.error('Failed to save music list:', e);
    }
  }, [musicList]);

  // Player state
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Continuous playback options
  const [autoContinuousPlay, setAutoContinuousPlay] = useState(true); // 連続再生 (True by default)
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [isShuffle, setIsShuffle] = useState(false);

  // UI / Search & Edit
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Audio HTML element ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentTrack = currentTrackIndex !== null ? musicList[currentTrackIndex] : null;

  // Sync Audio source when current track changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (currentTrack) {
      audioRef.current.src = currentTrack.url;
      audioRef.current.volume = isMuted ? 0 : volume;
      if (isPlaying) {
        audioRef.current
          .play()
          .catch((err) => console.log('Autoplay blocked or audio load error:', err));
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentTrackIndex]);

  // Handle Audio Play/Pause state
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (currentTrackIndex === null && musicList.length > 0) {
      setCurrentTrackIndex(0);
      setIsPlaying(true);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.error('Play error:', e));
    }
  };

  // Play specific track
  const handleSelectTrack = (index: number) => {
    if (currentTrackIndex === index) {
      togglePlay();
    } else {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  };

  // Next Track Logic (Continuous Playback)
  const handleNextTrack = () => {
    if (musicList.length === 0) return;

    if (repeatMode === 'one' && currentTrackIndex !== null) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
      return;
    }

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * musicList.length);
      setCurrentTrackIndex(randomIndex);
      setIsPlaying(true);
      return;
    }

    if (currentTrackIndex === null) {
      setCurrentTrackIndex(0);
    } else if (currentTrackIndex < musicList.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
    } else {
      // End of list
      if (repeatMode === 'all') {
        setCurrentTrackIndex(0);
      } else {
        setIsPlaying(false);
      }
    }
    setIsPlaying(true);
  };

  // Previous Track
  const handlePrevTrack = () => {
    if (musicList.length === 0) return;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (currentTrackIndex === null || currentTrackIndex === 0) {
      setCurrentTrackIndex(musicList.length - 1);
    } else {
      setCurrentTrackIndex(currentTrackIndex - 1);
    }
    setIsPlaying(true);
  };

  // Audio ended callback (Continuous playback handler)
  const handleAudioEnded = () => {
    if (autoContinuousPlay) {
      handleNextTrack();
    } else {
      setIsPlaying(false);
    }
  };

  // Time update callback
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  // Seek bar handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Volume slider handler
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume;
    }
  };

  // Add music files (MP3, MP4, M4A, FLAC)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    Array.from(files).forEach((file: File) => {
      const extension = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
      const fileUrl = URL.createObjectURL(file);

      // Extract file name without extension as default title
      const rawTitle = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      // Estimate audio duration using a temporary Audio element
      const tempAudio = new Audio(fileUrl);
      tempAudio.onloadedmetadata = () => {
        const audioDuration = tempAudio.duration || 180;

        const newMusicItem: MusicItem = {
          id: `music-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: rawTitle,
          artist: 'マイライブラリ',
          album: '追加された音楽',
          duration: Math.round(audioDuration),
          url: fileUrl,
          coverUrl: undefined,
          format: extension,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          createdAt: new Date().toISOString(),
        };

        setMusicList((prev) => [newMusicItem, ...prev]);
        setIsUploading(false);
      };

      tempAudio.onerror = () => {
        // Fallback if metadata fails
        const newMusicItem: MusicItem = {
          id: `music-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          title: rawTitle,
          artist: 'マイライブラリ',
          album: '追加された音楽',
          duration: 180,
          url: fileUrl,
          coverUrl: undefined,
          format: extension,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          createdAt: new Date().toISOString(),
        };

        setMusicList((prev) => [newMusicItem, ...prev]);
        setIsUploading(false);
      };
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete Track
  const handleDeleteTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('この音楽ファイルをマイライブラリから削除しますか？')) return;

    setMusicList((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      return updated;
    });

    if (currentTrack?.id === id) {
      setCurrentTrackIndex(null);
      setIsPlaying(false);
    }
  };

  // Start Edit Track
  const handleStartEdit = (track: MusicItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrackId(track.id);
    setEditTitle(track.title);
    setEditArtist(track.artist);
  };

  // Save Edit
  const handleSaveEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMusicList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, title: editTitle.trim() || item.title, artist: editArtist.trim() || item.artist } : item
      )
    );
    setEditingTrackId(null);
  };

  // Format time (seconds -> mm:ss)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Filtered music list
  const filteredList = musicList.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.format.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleAudioEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-2 sticky top-0 z-20 shadow-sm">
        {onGoHome && (
          <button onClick={onGoHome} className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-[#00c300] flex items-center justify-center">
            <Music className="w-4 h-4" />
          </div>
          <h1 className="font-bold text-slate-800 text-base leading-tight">音楽ライブラリ</h1>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/mp4,.mp3,.mp4,.m4a,.flac"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="bg-[#00c300] hover:bg-[#00b300] active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>音楽を追加</span>
        </button>
      </header>

      {/* Continuous Playback Banner & Controls */}
      <div className="bg-emerald-50/80 border-b border-emerald-100 px-4 py-2 flex items-center justify-between text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${autoContinuousPlay ? 'text-[#00c300] animate-pulse' : 'text-slate-400'}`} />
          <span className="font-medium">連続再生モード:</span>
          <span className={autoContinuousPlay ? 'font-bold text-[#00c300]' : 'text-slate-500'}>
            {autoContinuousPlay ? '有効 (曲が終わると自動で次の曲)' : '無効'}
          </span>
        </div>

        <button
          onClick={() => setAutoContinuousPlay(!autoContinuousPlay)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
            autoContinuousPlay
              ? 'bg-[#00c300] text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          {autoContinuousPlay ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-white border-b border-slate-100">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="曲名、アーティスト、ファイル形式で検索..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#00c300]/50"
          />
        </div>
      </div>

      {/* Music Track List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-36">
        {filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <FileAudio className="w-12 h-12 mb-2 text-slate-300" />
            <p className="text-sm font-medium">登録されている音楽がありません</p>
            <p className="text-xs text-slate-400 mt-1">「音楽を追加」からMP3, MP4, M4A, FLACを追加してください</p>
          </div>
        ) : (
          filteredList.map((track) => {
            const originalIndex = musicList.findIndex((m) => m.id === track.id);
            const isCurrent = currentTrackIndex === originalIndex;
            const isEditing = editingTrackId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => !isEditing && handleSelectTrack(originalIndex)}
                className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                  isCurrent
                    ? 'bg-emerald-50/90 border-[#00c300] shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Track Thumbnail or Disc Icon */}
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center text-white">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <Disc className={`w-6 h-6 ${isCurrent && isPlaying ? 'animate-spin text-[#00c300]' : 'text-slate-400'}`} />
                    )}

                    {isCurrent && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Track Info or Edit Mode */}
                  {isEditing ? (
                    <div className="flex-1 space-y-1 pr-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="曲名"
                        className="w-full text-xs font-semibold px-2 py-1 border rounded bg-white"
                      />
                      <input
                        type="text"
                        value={editArtist}
                        onChange={(e) => setEditArtist(e.target.value)}
                        placeholder="アーティスト名"
                        className="w-full text-[11px] px-2 py-0.5 border rounded bg-white"
                      />
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className={`text-xs font-bold truncate ${isCurrent ? 'text-[#00c300]' : 'text-slate-800'}`}>
                          {track.title}
                        </h3>
                        <span className="text-[9px] px-1.5 py-0.2 font-mono uppercase bg-slate-100 text-slate-600 rounded border border-slate-200">
                          {track.format}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </p>
                      {/* コメント表示・編集 */}
                      <input
                        type="text"
                        value={track.comment ?? ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMusicList((prev) => prev.map((t) => t.id === track.id ? { ...t, comment: val } : t));
                        }}
                        onBlur={() => {
                          const saved = JSON.parse(localStorage.getItem('line_app_music_list') || '[]');
                          const updated = saved.map((t: MusicItem) => t.id === track.id ? { ...t, comment: track.comment } : t);
                          localStorage.setItem('line_app_music_list', JSON.stringify(updated));
                        }}
                        placeholder="＋ コメント"
                        className="w-full text-[10px] text-slate-400 placeholder-slate-300 bg-transparent border-none focus:outline-none focus:text-slate-600 mt-0.5 truncate"
                      />
                    </div>
                  )}
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-2 pl-2 flex-shrink-0">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatTime(track.duration)}
                  </span>

                  {isEditing ? (
                    <button
                      onClick={(e) => handleSaveEdit(track.id, e)}
                      className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      title="保存"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleStartEdit(track, e)}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                      title="編集"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDeleteTrack(track.id, e)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Music Player */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 text-white border-t border-slate-800 p-3 shadow-2xl z-20">
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!currentTrack}
            className="flex-1 h-1 bg-slate-700 accent-[#00c300] rounded-lg cursor-pointer"
          />
          <span className="text-[10px] font-mono text-slate-400 w-8">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Current Playing Track Info */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-md bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700 flex items-center justify-center">
              {currentTrack?.coverUrl ? (
                <img src={currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Disc className={`w-5 h-5 ${isPlaying ? 'animate-spin text-[#00c300]' : 'text-slate-500'}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate">
                {currentTrack ? currentTrack.title : '再生中の曲なし'}
              </h4>
              <p className="text-[10px] text-slate-400 truncate">
                {currentTrack ? `${currentTrack.artist} (${currentTrack.format})` : 'リストから選択してください'}
              </p>
            </div>
          </div>

          {/* Player Buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Shuffle */}
            <button
              onClick={() => setIsShuffle(!isShuffle)}
              className={`p-1 transition ${isShuffle ? 'text-[#00c300]' : 'text-slate-400 hover:text-white'}`}
              title="シャッフル再生"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            {/* Prev */}
            <button
              onClick={handlePrevTrack}
              disabled={musicList.length === 0}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              disabled={musicList.length === 0}
              className="w-8 h-8 rounded-full bg-[#00c300] hover:bg-[#00b300] active:scale-95 text-white flex items-center justify-center shadow-md disabled:opacity-40 transition"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={handleNextTrack}
              disabled={musicList.length === 0}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-40"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Repeat Mode */}
            <button
              onClick={() => {
                if (repeatMode === 'off') setRepeatMode('all');
                else if (repeatMode === 'all') setRepeatMode('one');
                else setRepeatMode('off');
              }}
              className={`p-1 relative transition ${
                repeatMode !== 'off' ? 'text-[#00c300]' : 'text-slate-400 hover:text-white'
              }`}
              title={`リピート: ${repeatMode}`}
            >
              <Repeat className="w-3.5 h-3.5" />
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-[#00c300] text-black px-0.5 rounded-full">
                  1
                </span>
              )}
            </button>

            {/* Volume toggle */}
            <button
              onClick={toggleMute}
              className="p-1 text-slate-400 hover:text-white"
              title="音量切替"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
