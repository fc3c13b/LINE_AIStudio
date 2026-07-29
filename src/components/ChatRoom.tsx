import React, { useState, useEffect, useRef } from 'react';
import type { ChatRoom as ChatRoomType, Message, User, Sticker } from '../types';
import { STICKER_SETS } from '../data/stickers';
import {
  ChevronLeft,
  Phone,
  Video as VideoIcon,
  Smile,
  Plus,
  Send,
  Image as ImageIcon,
  Film,
  Mic,
  Square,
  Play,
  Pause,
  Sparkles,
  Check,
  CheckCheck,
  X,
  Volume2,
  Upload,
  Loader2,
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
}) => {
  const [inputText, setInputText] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeStickerTab, setActiveStickerTab] = useState(0);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAiRoom = room.id === 'room-ai' || room.members.some((m) => m.id === 'user-ai');

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
            // Send message with server saved URL
            onSendMessage(isVideo ? 'video' : 'image', data.url, { fileName: file.name });
          } else {
            // Fallback
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

  const handleSendSampleImage = (url: string) => {
    onSendMessage('image', url);
    setShowPlusMenu(false);
  };

  const handleStopAndSendVoice = () => {
    if (recordingSeconds > 0) {
      onSendMessage('voice', 'ボイスメッセージ', { duration: recordingSeconds });
    }
    setIsRecordingVoice(false);
    setShowPlusMenu(false);
  };

  const formatMessageTime = (isoStr: string) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col bg-[#7494c0] overflow-hidden relative font-sans h-full w-full min-h-0">
      {/* Header */}
      <div className="bg-[#00c300] text-white px-4 py-3 flex items-center justify-between z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1 hover:bg-black/10 rounded-full transition text-white"
            title="戻る"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src={room.avatar}
              alt={room.name}
              className="w-10 h-10 rounded-full object-cover border border-white/30 shadow-xs"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base tracking-tight leading-none text-white">{room.name}</h1>
                {isAiRoom && <Sparkles className="w-4 h-4 text-amber-200" />}
              </div>
              <p className="text-[11px] text-white/80 mt-0.5">
                {room.isGroup ? `${room.members.length}人のメンバー` : 'Online'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onStartCall('voice')}
            className="p-2 hover:bg-white/10 rounded-full text-white transition"
            title="音声通話"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => onStartCall('video')}
            className="p-2 hover:bg-white/10 rounded-full text-white transition"
            title="ビデオ通話"
          >
            <VideoIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        <div className="flex justify-center my-1">
          <span className="px-3.5 py-1 bg-black/10 text-white text-[10px] font-medium rounded-full backdrop-blur-xs">
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

          return (
            <div key={msg.id} className={`flex items-start gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <img
                  src={msg.senderAvatar}
                  alt={msg.senderName}
                  className="w-8 h-8 rounded-xl object-cover bg-gray-300 shrink-0 border border-white/20 shadow-xs mt-1"
                />
              )}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[78%]`}>
                {!isMe && (
                  <span className="text-[10px] text-white/80 font-medium mb-1 ml-1">
                    {msg.senderName}
                  </span>
                )}

                <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Message Content Bubble */}
                  <div
                    className={`p-3 rounded-2xl text-sm shadow-sm relative break-words leading-relaxed ${
                      isMe
                        ? 'bg-[#85e249] text-slate-900 rounded-tr-none border border-emerald-400/60'
                        : 'bg-white text-slate-900 rounded-tl-none border border-slate-200/90'
                    }`}
                  >
                    {msg.type === 'text' && <p className="whitespace-pre-wrap">{msg.content}</p>}

                    {msg.type === 'sticker' && (
                      <div className="p-1">
                        <img
                          src={msg.content}
                          alt="スタンプ"
                          className="w-28 h-28 object-contain rounded-lg hover:scale-105 transition"
                        />
                      </div>
                    )}

                    {msg.type === 'image' && (
                      <div className="max-w-[200px] overflow-hidden rounded-lg border border-black/10">
                        <img src={msg.content} alt="送信画像" className="w-full h-auto object-cover" />
                      </div>
                    )}

                    {msg.type === 'video' && (
                      <div className="max-w-[240px] overflow-hidden rounded-xl border border-black/10 bg-black">
                        <video
                          src={msg.content}
                          controls
                          className="w-full h-auto max-h-56 rounded-xl object-cover"
                        />
                      </div>
                    )}

                    {msg.type === 'voice' && (
                      <div className="flex items-center gap-2.5 py-1 min-w-[140px]">
                        <button
                          onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)}
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
                  </div>

                  {/* Read / Timestamp Indicator */}
                  <div className={`flex flex-col text-[9px] text-white/60 shrink-0 mb-1 ${isMe ? 'items-end text-right' : 'items-start'}`}>
                    {isMe && (
                      <span className="font-bold text-white/90 leading-tight">
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

      {/* Hidden File Input for Image/Video Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Plus Menu Drawer (Photos/Videos/Voice) */}
      {showPlusMenu && (
        <div className="bg-white border-t border-slate-200 p-3 grid grid-cols-4 gap-2 animate-in slide-in-from-bottom-2 duration-200 shrink-0 z-20">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition text-emerald-800"
            title="写真や動画を端末から選択"
          >
            <Upload className="w-5 h-5 text-emerald-600" />
            <span className="text-[11px] font-bold">ファイル選択</span>
          </button>

          <button
            onClick={() =>
              onSendMessage(
                'video',
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
              )
            }
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition text-purple-800"
            title="サンプル動画を送信"
          >
            <Film className="w-5 h-5 text-purple-600" />
            <span className="text-[11px] font-bold">動画送信</span>
          </button>

          <button
            onClick={() =>
              handleSendSampleImage(
                'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&auto=format&fit=crop&q=80'
              )
            }
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition text-blue-800"
          >
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <span className="text-[11px] font-bold">写真送信</span>
          </button>

          <button
            onClick={() => setIsRecordingVoice(!isRecordingVoice)}
            className="flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 transition text-rose-800"
          >
            <Mic className="w-5 h-5 text-rose-600" />
            <span className="text-[11px] font-bold">ボイス録音</span>
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
              className="px-3 py-1 bg-slate-200 text-slate-700 font-bold text-xs rounded-full"
            >
              キャンセル
            </button>
            <button
              onClick={handleStopAndSendVoice}
              className="px-3.5 py-1 bg-red-600 text-white font-bold text-xs rounded-full shadow"
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
                className={`px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
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
          <div className="flex-1 p-3 grid grid-cols-3 gap-3 overflow-y-auto">
            {STICKER_SETS[activeStickerTab].stickers.map((stk) => (
              <button
                key={stk.id}
                onClick={() => handleSendSticker(stk)}
                className="p-2 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md transition flex flex-col items-center justify-center gap-1 group"
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
            <span>ファイルをサーバーへ送信中...</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-normal">少しお待ちください</span>
        </div>
      )}

      {/* Bottom Message Input Form */}
      <form
        onSubmit={handleSendText}
        className="bg-white px-3 py-3 border-t-2 border-slate-200 flex items-center gap-2 z-30 shrink-0 shadow-lg"
      >
        <button
          type="button"
          onClick={() => {
            setShowPlusMenu(!showPlusMenu);
            setShowStickerPicker(false);
          }}
          className={`p-2 rounded-xl transition shrink-0 ${
            showPlusMenu ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
          }`}
          title="メニュー"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowStickerPicker(!showStickerPicker);
            setShowPlusMenu(false);
          }}
          className={`p-2 rounded-xl transition shrink-0 ${
            showStickerPicker ? 'bg-emerald-100 text-[#00c300]' : 'text-slate-500 hover:bg-slate-100'
          }`}
          title="スタンプ"
        >
          <Smile className="w-5 h-5" />
        </button>

        <div className="flex-1 relative min-w-0">
          <input
            type="text"
            value={inputText}
            onChange={handleTextChange}
            placeholder="メッセージを入力..."
            className="w-full bg-slate-50 border-2 border-slate-300 focus:border-[#00c300] focus:bg-white rounded-2xl px-4 py-2 text-sm text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00c300]/20 transition shadow-xs"
          />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`p-2.5 rounded-xl transition shrink-0 shadow-sm ${
            inputText.trim()
              ? 'bg-[#00c300] text-white hover:bg-[#00b000] active:scale-95 cursor-pointer font-bold'
              : 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
          }`}
          title="送信"
        >
          <Send className="w-5 h-5 fill-current" />
        </button>
      </form>
    </div>
  );
};
