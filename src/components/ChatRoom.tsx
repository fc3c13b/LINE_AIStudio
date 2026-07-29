import React, { useState, useEffect, useRef } from 'react';
import type { ChatRoom as ChatRoomType, Message, User, Sticker } from '../types';
import { STICKER_SETS } from '../data/stickers';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Video as VideoIcon,
  Smile,
  Plus,
  Send,
  Image as ImageIcon,
  Camera,
  Film,
  Mic,
  Square,
  Play,
  Pause,
  Sparkles,
  Check,
  X,
  Volume2,
  Upload,
  Loader2,
  Maximize2,
  Menu,
  Search,
  Bell,
  BellOff,
  Images,
  FolderPlus,
  MapPin,
  Copy,
  RotateCcw,
  Trash2,
} from 'lucide-react';

interface ChatRoomProps {
  room: ChatRoomType;
  currentUser: User;
  messages: Message[];
  onSendMessage: (type: Message['type'], content: string, meta?: any) => void;
  onBack: () => void;
  onStartCall: (type: 'voice' | 'video') => void;
  isPartnerTyping?: boolean;
  onSendTypingStatus: (isTyping: boolean) => void;
  onOpenAlbums?: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  room,
  currentUser,
  messages,
  onSendMessage,
  onBack,
  onStartCall,
  isPartnerTyping = false,
  onSendTypingStatus,
  onOpenAlbums,
}) => {
  const [inputText, setInputText] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeStickerTab, setActiveStickerTab] = useState(0);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [isNotificationsOn, setIsNotificationsOn] = useState(true);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Message Reaction & Context Menu State
  const [selectedMsgForMenu, setSelectedMsgForMenu] = useState<Message | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({}); // msgId -> emoji

  // Fullscreen Media Lightbox State
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAiRoom = room.id === 'room-ai' || room.members.some((m) => m.id === 'user-ai');

  // Filter image and video messages for the media viewer
  const mediaMessages = messages.filter((m) => m.type === 'image' || m.type === 'video');

  const openViewerForMessage = (messageId: string) => {
    const idx = mediaMessages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      setViewerIndex(idx);
      setDragOffsetX(0);
    }
  };

  const closeViewer = () => {
    setViewerIndex(null);
    setDragOffsetX(0);
    setIsDragging(false);
  };

  const goToNextMedia = () => {
    if (viewerIndex !== null && viewerIndex < mediaMessages.length - 1) {
      setViewerIndex(viewerIndex + 1);
      setDragOffsetX(0);
    }
  };

  const goToPrevMedia = () => {
    if (viewerIndex !== null && viewerIndex > 0) {
      setViewerIndex(viewerIndex - 1);
      setDragOffsetX(0);
    }
  };

  // Drag / Swipe handlers for full screen lightbox
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || dragStartX === null) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = clientX - dragStartX;
    setDragOffsetX(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 60;
    if (dragOffsetX < -threshold) {
      goToNextMedia();
    } else if (dragOffsetX > threshold) {
      goToPrevMedia();
    } else {
      setDragOffsetX(0);
    }
    setDragStartX(null);
  };

  // Keyboard Navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewerIndex === null) return;
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') goToNextMedia();
      if (e.key === 'ArrowLeft') goToPrevMedia();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerIndex, mediaMessages.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      if (evt.target?.result) {
        const dataUrl = evt.target.result as string;
        const isVideo = file.type.startsWith('video');

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, dataUrl }),
          });

          if (res.ok) {
            const data = await res.json();
            onSendMessage(isVideo ? 'video' : 'image', data.url, { fileName: file.name });
          } else {
            onSendMessage(isVideo ? 'video' : 'image', dataUrl, { fileName: file.name });
          }
        } catch (uploadErr) {
          console.error('Failed to upload file to server:', uploadErr);
          onSendMessage(isVideo ? 'video' : 'image', dataUrl, { fileName: file.name });
        } finally {
          setIsUploadingFile(false);
          setShowPlusMenu(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  // Voice recording timer
  useEffect(() => {
    if (isRecordingVoice) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecordingVoice]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onSendTypingStatus(e.target.value.length > 0);
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage('text', inputText.trim());
    setInputText('');
    onSendTypingStatus(false);
    setShowStickerPicker(false);
    setShowPlusMenu(false);
  };

  const handleSendSticker = (sticker: Sticker) => {
    onSendMessage('sticker', sticker.imageUrl, { stickerCategory: sticker.category });
    setShowStickerPicker(false);
  };

  const handleStopAndSendVoice = () => {
    if (recordingSeconds > 0) {
      onSendMessage('voice', 'ボイスメッセージ', { duration: recordingSeconds });
    }
    setIsRecordingVoice(false);
    setShowPlusMenu(false);
  };

  const handleAddReaction = (msgId: string, emoji: string) => {
    setReactions((prev) => ({ ...prev, [msgId]: prev[msgId] === emoji ? '' : emoji }));
    setSelectedMsgForMenu(null);
  };

  const formatMessageTime = (isoStr: string) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#7494c0] overflow-hidden relative font-sans h-full w-full min-h-0">
      {/* Official LINE Style Chat Room Header */}
      <div className="bg-[#00c300] text-white px-3 py-2.5 flex items-center justify-between z-20 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 hover:bg-black/10 rounded-full transition text-white cursor-pointer"
            title="戻る"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src={room.avatar}
              alt={room.name}
              className="w-9 h-9 rounded-full object-cover border border-white/30 shadow-xs"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm sm:text-base tracking-tight leading-none text-white">{room.name}</h1>
                {isAiRoom && <Sparkles className="w-3.5 h-3.5 text-amber-200" />}
              </div>
              <p className="text-[10px] text-white/80 mt-0.5 font-medium">
                {room.isGroup ? `${room.members.length}人のメンバー` : 'オンライン'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStartCall('voice')}
            className="p-2 hover:bg-white/10 rounded-full text-white transition cursor-pointer"
            title="音声通話"
          >
            <Phone className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => onStartCall('video')}
            className="p-2 hover:bg-white/10 rounded-full text-white transition cursor-pointer"
            title="ビデオ通話"
          >
            <VideoIcon className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => setShowChatMenu(!showChatMenu)}
            className="p-2 hover:bg-white/10 rounded-full text-white transition cursor-pointer"
            title="トークメニュー (≡)"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Slide-over Chat Drawer Menu (LINE Style) */}
      {showChatMenu && (
        <div className="absolute inset-0 bg-black/50 z-40 flex justify-end animate-in fade-in duration-150">
          <div className="w-72 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-800">トークメニュー</span>
              <button
                onClick={() => setShowChatMenu(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Grid Shortcuts */}
            <div className="p-4 grid grid-cols-3 gap-3 border-b border-slate-100">
              <button
                onClick={() => {
                  setShowChatMenu(false);
                  setIsNotificationsOn(!isNotificationsOn);
                }}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  {isNotificationsOn ? <Bell className="w-5 h-5 text-emerald-600" /> : <BellOff className="w-5 h-5 text-slate-400" />}
                </div>
                <span className="text-[11px] font-bold text-slate-700">
                  {isNotificationsOn ? '通知 ON' : '通知 OFF'}
                </span>
              </button>

              <button
                onClick={() => {
                  setShowChatMenu(false);
                  if (onOpenAlbums) onOpenAlbums();
                }}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-emerald-50 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Images className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-slate-800">アルバム</span>
              </button>

              <button
                onClick={() => {
                  setShowChatMenu(false);
                  if (mediaMessages.length > 0) {
                    openViewerForMessage(mediaMessages[0].id);
                  } else {
                    alert('このトークにはまだ写真・動画がありません');
                  }
                }}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <Camera className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-[11px] font-bold text-slate-700">写真・動画</span>
              </button>
            </div>

            {/* Drawer Links */}
            <div className="p-2 flex-1 space-y-1">
              <button
                onClick={() => {
                  setShowChatMenu(false);
                  if (onOpenAlbums) onOpenAlbums();
                }}
                className="w-full p-3 text-left font-bold text-xs text-slate-800 hover:bg-slate-100 rounded-xl flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FolderPlus className="w-4 h-4 text-emerald-600" />
                  <span>アルバムの作成・閲覧</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  setShowChatMenu(false);
                  alert('位置情報の共有リンクを送信しました');
                  onSendMessage('text', '📍 位置情報を共有しました: 東京都千代田区1-1');
                }}
                className="w-full p-3 text-left font-bold text-xs text-slate-800 hover:bg-slate-100 rounded-xl flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <span>位置情報を共有</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 text-center">
              LINE公式仕様 トークルーム 設定完了
            </div>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-3.5">
        <div className="flex justify-center my-1">
          <span className="px-3.5 py-1 bg-black/15 text-white text-[10px] font-medium rounded-full backdrop-blur-xs">
            {new Date().toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'short',
            })}
          </span>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const isRead = msg.readBy && msg.readBy.length > 1;
          const msgReaction = reactions[msg.id];

          return (
            <div key={msg.id} className={`flex items-start gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <img
                  src={msg.senderAvatar}
                  alt={msg.senderName}
                  className="w-8 h-8 rounded-full object-cover bg-gray-300 shrink-0 border border-white/20 shadow-xs mt-1"
                />
              )}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                {!isMe && (
                  <span className="text-[10px] text-white/90 font-bold mb-1 ml-1">
                    {msg.senderName}
                  </span>
                )}

                <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Message Content Bubble (LINE Green `#85e249` for Me, White for Partner) */}
                  <div
                    onClick={() => setSelectedMsgForMenu(selectedMsgForMenu?.id === msg.id ? null : msg)}
                    className={`p-3 rounded-2xl text-sm shadow-xs relative break-words leading-relaxed transition cursor-pointer select-none ${
                      isMe
                        ? 'bg-[#85e249] text-slate-950 rounded-tr-none font-normal'
                        : 'bg-white text-slate-900 rounded-tl-none border border-slate-200/90'
                    }`}
                  >
                    {msg.type === 'text' && <p className="whitespace-pre-wrap">{msg.content}</p>}

                    {msg.type === 'sticker' && (
                      <div className="p-0.5">
                        <img
                          src={msg.content}
                          alt="スタンプ"
                          className="w-28 h-28 object-contain rounded-lg hover:scale-105 transition"
                        />
                      </div>
                    )}

                    {msg.type === 'image' && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          openViewerForMessage(msg.id);
                        }}
                        className="max-w-[220px] overflow-hidden rounded-xl border border-black/10 cursor-pointer relative group transition hover:opacity-95 shadow-xs"
                        title="タップして全画面表示"
                      >
                        <img src={msg.content} alt="送信画像" className="w-full h-auto object-cover" />
                        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition backdrop-blur-xs">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}

                    {msg.type === 'video' && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          openViewerForMessage(msg.id);
                        }}
                        className="max-w-[240px] overflow-hidden rounded-xl border border-black/10 bg-black cursor-pointer relative group shadow-xs"
                        title="タップして全画面表示"
                      >
                        <video
                          src={msg.content}
                          className="w-full h-auto max-h-56 rounded-xl object-cover"
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition">
                          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center border border-white/30 group-hover:scale-110 transition">
                            <Play className="w-5 h-5 ml-0.5 fill-current" />
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition backdrop-blur-xs">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    )}

                    {msg.type === 'voice' && (
                      <div className="flex items-center gap-2.5 py-1 min-w-[140px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id);
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition ${
                            isMe ? 'bg-white text-[#00c300]' : 'bg-[#00c300] text-white'
                          }`}
                        >
                          {playingVoiceId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </button>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1">
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>ボイスメッセージ</span>
                          </div>
                          <div className="text-[10px] opacity-80">{msg.meta?.duration || 3}秒</div>
                        </div>
                      </div>
                    )}

                    {/* Reaction Badge on Message */}
                    {msgReaction && (
                      <div className="absolute -bottom-2 -right-2 bg-white border border-slate-200 px-1.5 py-0.5 rounded-full text-xs shadow-md animate-in zoom-in-50">
                        {msgReaction}
                      </div>
                    )}
                  </div>

                  {/* Read / Timestamp Indicator (Standard LINE: Left side for own messages, Right side for partner) */}
                  <div className={`flex flex-col text-[9px] text-white/80 font-medium shrink-0 mb-0.5 ${isMe ? 'items-end text-right' : 'items-start'}`}>
                    {isMe && (
                      <span className="font-bold text-white text-[10px] leading-tight">
                        {isRead ? '既読' : ''}
                      </span>
                    )}
                    <span>{formatMessageTime(msg.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Partner Typing Indicator */}
        {isPartnerTyping && (
          <div className="flex items-center gap-2 text-white/90 text-xs italic pl-2 py-1">
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce" />
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="inline-block w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
            <span className="ml-1 font-medium">相手が入力中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* LINE Style Message Action Popup */}
      {selectedMsgForMenu && (
        <div
          onClick={() => setSelectedMsgForMenu(null)}
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-3 shadow-2xl border border-slate-200 space-y-3 max-w-xs w-full animate-in zoom-in-95"
          >
            {/* Reaction Emoji Row */}
            <div className="flex items-center justify-around bg-slate-100 p-2 rounded-xl">
              {['👍', '❤️', '😆', '😲', '😢', '😡'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleAddReaction(selectedMsgForMenu.id, emoji)}
                  className="text-xl hover:scale-125 transition p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions List */}
            <div className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
              <button
                onClick={() => {
                  setInputText(`> ${selectedMsgForMenu.content}\n`);
                  setSelectedMsgForMenu(null);
                }}
                className="w-full py-2.5 text-left flex items-center gap-2 px-2 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-blue-500" />
                <span>リプライ (返信)</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(selectedMsgForMenu.content);
                  alert('メッセージをコピーしました');
                  setSelectedMsgForMenu(null);
                }}
                className="w-full py-2.5 text-left flex items-center gap-2 px-2 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <Copy className="w-4 h-4 text-emerald-600" />
                <span>コピー</span>
              </button>
              <button
                onClick={() => {
                  alert('送信を取り消しました');
                  setSelectedMsgForMenu(null);
                }}
                className="w-full py-2.5 text-left flex items-center gap-2 px-2 hover:bg-slate-50 rounded-lg text-red-600 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>送信取消</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input for Image/Video Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Plus Menu Drawer (Official LINE: Camera, Gallery, File, Location, Contact, Voice) */}
      {showPlusMenu && (
        <div className="bg-white border-t border-slate-200 p-3 grid grid-cols-4 gap-2 animate-in slide-in-from-bottom-2 duration-200 shrink-0 z-20">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 transition text-slate-800 cursor-pointer group"
          >
            <Camera className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition" />
            <span className="text-[10px] font-bold">カメラ</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 transition text-slate-800 cursor-pointer group"
          >
            <ImageIcon className="w-5 h-5 text-blue-600 group-hover:scale-110 transition" />
            <span className="text-[10px] font-bold">写真・動画</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 transition text-slate-800 cursor-pointer group"
          >
            <Upload className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition" />
            <span className="text-[10px] font-bold">ファイル</span>
          </button>

          <button
            onClick={() => setIsRecordingVoice(!isRecordingVoice)}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 transition text-slate-800 cursor-pointer group"
          >
            <Mic className="w-5 h-5 text-rose-600 group-hover:scale-110 transition" />
            <span className="text-[10px] font-bold">ボイス録音</span>
          </button>
        </div>
      )}

      {/* Voice Recording Overlay */}
      {isRecordingVoice && (
        <div className="bg-red-50 border-t border-red-200 p-3 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
            <span className="font-bold text-xs text-red-900">
              録音中: {recordingSeconds}秒
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRecordingVoice(false)}
              className="px-3 py-1 bg-slate-200 text-slate-700 font-bold text-xs rounded-full cursor-pointer"
            >
              キャンセル
            </button>
            <button
              onClick={handleStopAndSendVoice}
              className="px-3.5 py-1 bg-red-600 text-white font-bold text-xs rounded-full shadow cursor-pointer"
            >
              送信
            </button>
          </div>
        </div>
      )}

      {/* Sticker Drawer */}
      {showStickerPicker && (
        <div className="bg-slate-100 border-t border-slate-200 z-30 flex flex-col h-56 animate-in slide-in-from-bottom-2 shrink-0">
          {/* Sticker Categories */}
          <div className="flex bg-slate-200 border-b border-slate-300">
            {STICKER_SETS.map((set, idx) => (
              <button
                key={set.category}
                onClick={() => setActiveStickerTab(idx)}
                className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeStickerTab === idx
                    ? 'bg-white text-emerald-600 border-b-2 border-emerald-500'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{set.icon}</span>
                <span>{set.category}</span>
              </button>
            ))}
          </div>

          {/* Sticker Grid */}
          <div className="flex-1 p-3 grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto">
            {STICKER_SETS[activeStickerTab].stickers.map((stk) => (
              <button
                key={stk.id}
                onClick={() => handleSendSticker(stk)}
                className="p-2 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition flex flex-col items-center justify-center gap-1 group cursor-pointer"
              >
                <img src={stk.imageUrl} alt={stk.name} className="w-14 h-14 object-cover rounded-md group-hover:scale-105 transition" />
                <span className="text-[10px] font-bold text-slate-700">{stk.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* File Uploading Status Overlay */}
      {isUploadingFile && (
        <div className="bg-emerald-50 border-t border-emerald-300 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 font-bold z-30 shrink-0">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>ファイルをサーバーへ保存中...</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-normal">少しお待ちください</span>
        </div>
      )}

      {/* Official LINE Style Bottom Input Form Bar */}
      <form
        onSubmit={handleSendText}
        className="bg-white px-2.5 py-2 border-t border-slate-200 flex items-center gap-1.5 z-30 shrink-0 shadow-lg"
      >
        {/* 1. Plus Button (+) */}
        <button
          type="button"
          onClick={() => {
            setShowPlusMenu(!showPlusMenu);
            setShowStickerPicker(false);
          }}
          className={`p-2 rounded-full transition shrink-0 cursor-pointer ${
            showPlusMenu ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
          }`}
          title="プラスメニュー (+)"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* 2. Camera Button (📷) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition shrink-0 cursor-pointer"
          title="カメラ・写真選択"
        >
          <Camera className="w-5 h-5" />
        </button>

        {/* 3. Gallery Button (🖼️) */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition shrink-0 cursor-pointer"
          title="ギャラリー"
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        {/* 4. Rounded Text Input Pill containing Sticker Smile Button inside right */}
        <div className="flex-1 relative min-w-0 flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={handleTextChange}
            placeholder="メッセージを入力..."
            className="w-full bg-slate-100 border border-slate-200 focus:border-[#00c300] focus:bg-white rounded-full pl-3.5 pr-10 py-2 text-xs sm:text-sm text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00c300]/20 transition"
          />
          {/* Inside right Sticker button (😊) */}
          <button
            type="button"
            onClick={() => {
              setShowStickerPicker(!showStickerPicker);
              setShowPlusMenu(false);
            }}
            className={`absolute right-1.5 p-1.5 rounded-full transition shrink-0 cursor-pointer ${
              showStickerPicker ? 'bg-emerald-100 text-[#00c300]' : 'text-slate-400 hover:text-slate-600'
            }`}
            title="スタンプ"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* 5. Right Action Button: Mic icon when empty, Send arrow (➢) when text exists */}
        {inputText.trim() ? (
          <button
            type="submit"
            className="p-2.5 bg-[#00c300] hover:bg-[#00b000] text-white rounded-full transition shrink-0 shadow-sm cursor-pointer active:scale-95 flex items-center justify-center"
            title="送信"
          >
            <Send className="w-4 h-4 fill-current ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsRecordingVoice(!isRecordingVoice)}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition shrink-0 cursor-pointer"
            title="ボイスメッセージ"
          >
            <Mic className="w-4.5 h-4.5" />
          </button>
        )}
      </form>

      {/* Fullscreen Media Lightbox Modal */}
      {viewerIndex !== null && mediaMessages[viewerIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200">
          {/* Top Control Bar */}
          <div className="p-4 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent z-20">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wider">
                {viewerIndex + 1} / {mediaMessages.length}
              </span>
              <div className="flex items-center gap-2">
                <img
                  src={mediaMessages[viewerIndex].senderAvatar}
                  alt={mediaMessages[viewerIndex].senderName}
                  className="w-7 h-7 rounded-full object-cover border border-white/30"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-none">{mediaMessages[viewerIndex].senderName}</span>
                  <span className="text-[10px] text-slate-300 mt-0.5">
                    {mediaMessages[viewerIndex].timestamp}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={closeViewer}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white transition flex items-center justify-center cursor-pointer shadow-lg border border-white/20"
              title="閉じる (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Center Main Stage (Drag / Swipeable Area) */}
          <div
            className="flex-1 relative flex items-center justify-center overflow-hidden touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
          >
            {/* Left Nav Button */}
            {viewerIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevMedia();
                }}
                className="absolute left-3 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs z-30 border border-white/20 transition cursor-pointer"
                title="前の画像 (←)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Media Content with Drag Transform */}
            <div
              className="max-w-full max-h-full p-4 flex items-center justify-center transition-transform duration-75 ease-out cursor-grab active:cursor-grabbing"
              style={{
                transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX * 0.02}deg)`,
              }}
            >
              {mediaMessages[viewerIndex].type === 'video' ? (
                <video
                  src={mediaMessages[viewerIndex].content}
                  controls
                  autoPlay
                  className="max-h-[78vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain bg-black"
                />
              ) : (
                <img
                  src={mediaMessages[viewerIndex].content}
                  alt="全画面表示画像"
                  className="max-h-[78vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain pointer-events-none"
                />
              )}
            </div>

            {/* Right Nav Button */}
            {viewerIndex < mediaMessages.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextMedia();
                }}
                className="absolute right-3 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs z-30 border border-white/20 transition cursor-pointer"
                title="次の画像 (→)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Navigation */}
          {mediaMessages.length > 1 && (
            <div className="p-3 bg-gradient-to-t from-black/90 to-transparent z-20 flex justify-center gap-2 overflow-x-auto no-scrollbar">
              {mediaMessages.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setViewerIndex(idx);
                    setDragOffsetX(0);
                  }}
                  className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                    viewerIndex === idx
                      ? 'border-emerald-400 scale-110 shadow-md ring-2 ring-emerald-400/50'
                      : 'border-white/30 opacity-60 hover:opacity-100'
                  }`}
                >
                  {m.type === 'video' ? (
                    <video src={m.content} className="w-full h-full object-cover" />
                  ) : (
                    <img src={m.content} alt="thumb" className="w-full h-full object-cover" />
                  )}
                  {m.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                      <Film className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
