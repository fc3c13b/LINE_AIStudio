import React, { useState, useEffect } from 'react';
import { User, ChatRoom, Message, TabType, CallState, WSMessagePayload } from './types';
import { wsService } from './services/websocket';
import { SmartphoneFrame } from './components/SmartphoneFrame';
import { HomeTab } from './components/HomeTab';
import { ChatsTab } from './components/ChatsTab';
import { ChatRoom as ChatRoomComponent } from './components/ChatRoom';
import { CallScreen } from './components/CallScreen';
import { SettingsTab } from './components/SettingsTab';
import { NewChatModal } from './components/NewChatModal';
import { AuthModal } from './components/AuthModal';
import { Home, MessageSquare, Phone, Settings as SettingsIcon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomMessages, setRoomMessages] = useState<Record<string, Message[]>>({});
  const [partnerTyping, setPartnerTyping] = useState<Record<string, boolean>>({});

  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [callState, setCallState] = useState<CallState | null>(null);

  // Account & Auth state
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register' | 'forgot';
  }>({ isOpen: false, mode: 'login' });

  const [account, setAccount] = useState<{ id: string; name: string; email: string } | null>(() => {
    try {
      const saved = localStorage.getItem('line_app_account');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeUserId, setActiveUserId] = useState<string>(() => account?.id || 'user-me');

  const me: User = users.find((u) => u.id === activeUserId) || {
    id: activeUserId,
    name: account?.name || 'あなた',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    statusMessage: 'プログラミング勉強中 💻',
    isOnline: true,
  };

  const handleAuthSuccess = (user: User, accountInfo?: { id: string; name: string; email: string }) => {
    if (accountInfo) {
      setAccount(accountInfo);
      localStorage.setItem('line_app_account', JSON.stringify(accountInfo));
    }
    setActiveUserId(user.id);
    fetchData();
  };

  const handleLogout = () => {
    setAccount(null);
    localStorage.removeItem('line_app_account');
    setActiveUserId('user-me');
  };

  // 1. Initial REST fetch
  const fetchData = async () => {
    try {
      const [usersRes, roomsRes] = await Promise.all([
        fetch('/api/users').then((r) => r.json()),
        fetch('/api/rooms').then((r) => r.json()),
      ]);

      setUsers(usersRes);
      setRooms(roomsRes);

      // Fetch messages for initial rooms
      for (const room of roomsRes) {
        fetch(`/api/rooms/${room.id}/messages`)
          .then((r) => r.json())
          .then((msgs) => {
            setRoomMessages((prev) => ({ ...prev, [room.id]: msgs }));
          });
      }
    } catch (err) {
      console.error('Error fetching initial REST data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Connect WebSocket
    wsService.connect();

    // WebSocket Event Listener
    const unsubscribe = wsService.subscribe((payload: WSMessagePayload) => {
      setIsConnected(true);

      if (payload.type === 'init') {
        if (payload.onlineUsers) {
          setUsers((prev) =>
            prev.map((u) => ({ ...u, isOnline: payload.onlineUsers?.includes(u.id) }))
          );
        }
      } else if (payload.type === 'new_message' && payload.message) {
        const msg = payload.message;
        setRoomMessages((prev) => {
          const existing = prev[msg.roomId] || [];
          if (existing.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [msg.roomId]: [...existing, msg] };
        });

        // Update room lastMessage and unread count
        setRooms((prev) =>
          prev.map((r) => {
            if (r.id === msg.roomId) {
              const isCurrentOpenRoom = activeRoomId === msg.roomId;
              return {
                ...r,
                lastMessage: msg,
                updatedAt: msg.timestamp,
                unreadCount: isCurrentOpenRoom ? 0 : r.unreadCount + (msg.senderId !== me.id ? 1 : 0),
              };
            }
            return r;
          })
        );
      } else if (payload.type === 'typing' && payload.roomId) {
        setPartnerTyping((prev) => ({
          ...prev,
          [payload.roomId!]: !!payload.isTyping,
        }));
      } else if (payload.type === 'read_messages' && payload.roomId) {
        setRoomMessages((prev) => {
          const roomMsgs = prev[payload.roomId!] || [];
          return {
            ...prev,
            [payload.roomId!]: roomMsgs.map((m) => {
              if (!m.readBy.includes(payload.userId!)) {
                return { ...m, readBy: [...m.readBy, payload.userId!] };
              }
              return m;
            }),
          };
        });
      } else if (payload.type === 'create_room' && payload.room) {
        const newRoom = payload.room;
        setRooms((prev) => [newRoom, ...prev]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRoomId]);

  // Open Chat Room
  const handleOpenChat = (roomId: string) => {
    setActiveRoomId(roomId);

    // Reset unread count
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
    );

    // Send read status event
    wsService.send({
      type: 'read_messages',
      roomId,
      userId: me.id,
    });
  };

  // Send Message
  const handleSendMessage = (type: Message['type'], content: string, meta?: any) => {
    if (!activeRoomId) return;

    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roomId: activeRoomId,
      senderId: me.id,
      senderName: me.name,
      senderAvatar: me.avatar,
      type,
      content,
      timestamp: new Date().toISOString(),
      readBy: [me.id],
      meta,
    };

    // Optimistic UI update
    setRoomMessages((prev) => ({
      ...prev,
      [activeRoomId]: [...(prev[activeRoomId] || []), newMsg],
    }));

    setRooms((prev) =>
      prev.map((r) =>
        r.id === activeRoomId ? { ...r, lastMessage: newMsg, updatedAt: newMsg.timestamp } : r
      )
    );

    // Send via WebSocket
    wsService.send({
      type: 'send_message',
      message: newMsg,
    });
  };

  // Typing status emit
  const handleSendTypingStatus = (isTyping: boolean) => {
    if (!activeRoomId) return;
    wsService.send({
      type: 'typing',
      roomId: activeRoomId,
      userId: me.id,
      isTyping,
    });
  };

  // Create Room
  const handleCreateRoom = async (name: string, memberIds: string[], isGroup: boolean) => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, memberIds, isGroup }),
      });
      const room: ChatRoom = await res.json();
      setRooms((prev) => [room, ...prev]);
      handleOpenChat(room.id);
    } catch (err) {
      console.error('Error creating room:', err);
    }
  };

  // Update Profile
  const handleUpdateProfile = async (name: string, statusMessage: string, avatar: string) => {
    try {
      const res = await fetch('/api/users/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, statusMessage, avatar }),
      });
      const updatedUser: User = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === me.id ? updatedUser : u)));
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  // Reset Database
  const handleResetDatabase = async () => {
    try {
      await fetch('/api/seed/reset', { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Error resetting database:', err);
    }
  };

  // Start Call
  const handleStartCall = (type: 'voice' | 'video') => {
    const currentRoom = rooms.find((r) => r.id === activeRoomId);
    if (!currentRoom) return;

    setCallState({
      isActive: true,
      roomId: currentRoom.id,
      contactName: currentRoom.name,
      contactAvatar: currentRoom.avatar,
      type,
      status: 'connected',
      duration: 0,
    });
  };

  // Total unread messages across all rooms
  const totalUnread = rooms.reduce((acc, r) => acc + (r.unreadCount || 0), 0);
  const currentRoom = rooms.find((r) => r.id === activeRoomId);

  return (
    <SmartphoneFrame isConnected={isConnected}>
      {/* If Chat Room is Active, render full ChatRoom */}
      {activeRoomId && currentRoom ? (
        <ChatRoomComponent
          room={currentRoom}
          currentUser={me}
          messages={roomMessages[activeRoomId] || []}
          onSendMessage={handleSendMessage}
          onBack={() => setActiveRoomId(null)}
          onStartCall={handleStartCall}
          isPartnerTyping={partnerTyping[activeRoomId] || false}
          onSendTypingStatus={handleSendTypingStatus}
        />
      ) : (
        /* Tab Views */
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {activeTab === 'home' && (
            <HomeTab
              currentUser={me}
              users={users}
              rooms={rooms}
              onOpenChat={handleOpenChat}
              onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
              onOpenProfileSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'chats' && (
            <ChatsTab
              rooms={rooms}
              currentUser={me}
              onOpenChat={handleOpenChat}
              onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
            />
          )}

          {activeTab === 'calls' && (
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <h1 className="text-xl font-bold text-slate-900">通話</h1>
              </div>
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                  <Phone className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base">LINE 無料通話・ビデオ通話</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    トーク画面から相手を選んで高音質な無料音声通話・ビデオ通話を開始できます。
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('chats')}
                  className="px-5 py-2.5 bg-emerald-500 text-white font-bold text-xs rounded-full shadow-sm"
                >
                  トーク一覧を見る
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              currentUser={me}
              accountEmail={account?.email}
              onUpdateProfile={handleUpdateProfile}
              onResetDatabase={handleResetDatabase}
              onOpenAuthModal={(mode = 'login') =>
                setAuthModalState({ isOpen: true, mode })
              }
              onLogout={handleLogout}
              isConnected={isConnected}
            />
          )}

          {/* Bottom Tab Bar Navigation */}
          <nav className="bg-white border-t border-slate-200/80 px-2 py-2 flex items-center justify-around z-30 shadow-lg">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
                activeTab === 'home' ? 'text-[#00c300] font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px]">ホーム</span>
            </button>

            <button
              onClick={() => setActiveTab('chats')}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition relative ${
                activeTab === 'chats' ? 'text-[#00c300] font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 bg-[#00c300] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </div>
              <span className="text-[10px]">トーク</span>
            </button>

            <button
              onClick={() => setActiveTab('calls')}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
                activeTab === 'calls' ? 'text-[#00c300] font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Phone className="w-5 h-5" />
              <span className="text-[10px]">通話</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
                activeTab === 'settings' ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px]">設定</span>
            </button>
          </nav>
        </div>
      )}

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <NewChatModal
          users={users}
          currentUser={me}
          onClose={() => setIsNewChatModalOpen(false)}
          onCreateRoom={handleCreateRoom}
        />
      )}

      {/* Call Screen Overlay */}
      {callState && callState.isActive && (
        <CallScreen callState={callState} onEndCall={() => setCallState(null)} />
      )}

      {/* Auth Modal (Login / Register / Forgot Password) */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        onClose={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={handleAuthSuccess}
      />
    </SmartphoneFrame>
  );
}
