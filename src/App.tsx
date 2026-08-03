import React, { useState, useEffect, useRef } from 'react';
import { User, ChatRoom, Message, TabType, CallState, WSMessagePayload, FriendRequest } from './types';
import { wsService } from './services/websocket';
import { apiUrl, readApiResponse } from './services/api';
import { SmartphoneFrame } from './components/SmartphoneFrame';
import { HomeTab } from './components/HomeTab';
import { ChatsTab } from './components/ChatsTab';
import { ChatRoom as ChatRoomComponent } from './components/ChatRoom';
import { SettingsTab, DEFAULT_CHAT_SETTINGS, ChatSettings } from './components/SettingsTab';
import { AlbumTab } from './components/AlbumTab';
import { MusicTab } from './components/MusicTab';
import { UnauthenticatedGuard } from './components/UnauthenticatedGuard';
import { SolitaireGame } from './components/SolitaireGame';
import { ModalsContainer } from './components/ModalsContainer';
import { Home, MessageSquare, Images, Music, Settings as SettingsIcon } from 'lucide-react';
import { loadAllCachedMessages, cacheRoomMessages, clearMessageCache } from './services/messageCache';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [previousRoomId, setPreviousRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomMessages, setRoomMessages] = useState<Record<string, Message[]>>(() => loadAllCachedMessages());
  const [partnerTyping, setPartnerTyping] = useState<Record<string, boolean>>({});
  const [friendRequests, setFriendRequests] = useState<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({
    incoming: [],
    outgoing: [],
  });
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [adminDebugLog, setAdminDebugLog] = useState<string[]>([]);
  const addDebug = (msg: string) => setAdminDebugLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);

  // チャット表示設定（localStorageで永続化）
  const [chatSettings, setChatSettings] = useState<ChatSettings>(() => {
    try {
      const saved = localStorage.getItem('line_chat_settings');
      return saved ? { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_CHAT_SETTINGS;
    } catch { return DEFAULT_CHAT_SETTINGS; }
  });

  const handleChatSettingsChange = (s: ChatSettings) => {
    setChatSettings(s);
    localStorage.setItem('line_chat_settings', JSON.stringify(s));
  };

  // タイピング送信のデバウンス用
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<boolean>(false);
  const msgCacheTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // メッセージ変更時に2秒デバウンスでキャッシュ保存（10MB LRU管理）
  useEffect(() => {
    clearTimeout(msgCacheTimerRef.current);
    msgCacheTimerRef.current = setTimeout(() => {
      for (const [roomId, messages] of Object.entries(roomMessages)) {
        if (messages.length > 0) cacheRoomMessages(roomId, messages);
      }
    }, 2000);
    return () => clearTimeout(msgCacheTimerRef.current);
  }, [roomMessages]);

  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [callState, setCallState] = useState<CallState | null>(null);

  // Account & Auth state
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register' | 'forgot';
  }>({ isOpen: false, mode: 'login' });

  const [account, setAccount] = useState<{ id: string; name: string; email?: string; isAdmin?: boolean } | null>(() => {
    try {
      const saved = localStorage.getItem('line_app_account');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // キャッシュに isAdmin がない場合はユーザー名で補完（旧セッション対応）
      if (parsed && !parsed.isAdmin && parsed.name?.toLowerCase() === 'administrator') {
        parsed.isAdmin = true;
        localStorage.setItem('line_app_account', JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return null;
    }
  });

  // WS コールバック内で常に最新の accountId を参照するための ref（stale closure 対策）
  const accountIdRef = useRef<string | undefined>(undefined);
  useEffect(() => { accountIdRef.current = account?.id; }, [account]);

  const [appMode, setAppMode] = useState<'solitaire' | 'line'>('solitaire');
  const [showSolitaire, setShowSolitaire] = useState(false);

  // 背面移動時はソリティア画面へ（パスワードロックなし）
  const lockToSolitaire = () => setAppMode('solitaire');
  const lockTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ファイルピッカー等の一時的な非表示と本当のバックグラウンド移行を区別するため 3秒遅延
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && account) {
        lockTimerRef.current = setTimeout(() => lockToSolitaire(), 3000);
      } else {
        clearTimeout(lockTimerRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(lockTimerRef.current);
    };
  }, [account]);

  const [activeUserId, setActiveUserId] = useState<string>(() => account?.id || 'user-me');

  const me: User = users.find((u) => u.id === activeUserId) || {
    id: activeUserId,
    name: account?.name || 'あなた',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    statusMessage: 'プログラミング勉強中 💻',
    isOnline: true,
  };

  const handleAuthSuccess = (user: User, accountInfo?: { id: string; name: string; email?: string; isAdmin?: boolean }) => {
    if (accountInfo) {
      setAccount(accountInfo);
      localStorage.setItem('line_app_account', JSON.stringify(accountInfo));
      addDebug(`Step1 ログイン: name=${accountInfo.name} isAdmin=${accountInfo.isAdmin ?? 'undefined'}`);
      addDebug(`Step1 localStorage保存: ${JSON.stringify({ id: accountInfo.id, isAdmin: accountInfo.isAdmin })}`);
    }
    setActiveUserId(user.id);
    wsService.identify(user.id);
    setAdminDebugLog([]);
    fetchData();
  };

  const handleLogout = () => {
    setAccount(null);
    localStorage.removeItem('line_app_account');
    setActiveUserId('user-me');
    setFriendRequests({ incoming: [], outgoing: [] });
    setRoomMessages({});
    clearMessageCache();
    setAdminDebugLog([]);
  };

  // 1. Initial REST fetch
  const fetchData = async () => {
    try {
      addDebug(`Step2 fetchData開始: account.isAdmin=${account?.isAdmin ?? 'undefined'} id=${account?.id?.slice(0,8) ?? '未ログイン'}`);
      const [usersRes, roomsRes] = await Promise.all([
        fetch(apiUrl('/api/users')).then((response) => readApiResponse<User[]>(response)),
        fetch(apiUrl(`/api/rooms?userId=${encodeURIComponent(activeUserId)}`)).then((response) => readApiResponse<ChatRoom[]>(response)),
      ]);

      setUsers(usersRes);
      setRooms(roomsRes);
      addDebug(`Step2 /api/users: ${usersRes.length}人取得`);

      // Fetch messages for initial rooms（最新ページのみ）
      for (const room of roomsRes) {
        fetch(apiUrl(`/api/rooms/${room.id}/messages`))
          .then((response) => readApiResponse<{ messages: Message[]; hasMore: boolean }>(response))
          .then((data) => {
            setRoomMessages((prev) => ({ ...prev, [room.id]: data.messages }));
          });
      }

      // 友達申請一覧を取得
      if (account?.id) {
        fetchFriendRequests(account.id);
      }

      // 管理者権限をサーバーに問い合わせて確認・更新（旧セッション・旧APK対応）
      if (account?.id && !account.isAdmin) {
        addDebug(`Step2 /api/admin/users 問い合わせ中...`);
        fetch(apiUrl(`/api/admin/users?adminId=${encodeURIComponent(account.id)}`))
          .then(res => {
            addDebug(`Step2 /api/admin/users: HTTP ${res.status}`);
            if (res.ok) {
              setAccount(prev => {
                if (!prev || prev.isAdmin) return prev;
                const updated = { ...prev, isAdmin: true };
                localStorage.setItem('line_app_account', JSON.stringify(updated));
                addDebug(`Step2 isAdmin=true に更新完了`);
                return updated;
              });
            } else {
              addDebug(`Step2 管理者権限なし (403)`);
            }
          })
          .catch(e => addDebug(`Step2 エラー: ${e.message}`));
      } else if (account?.isAdmin) {
        addDebug(`Step2 既に isAdmin=true 済み`);
      }
    } catch (err) {
      console.error('Error fetching initial REST data:', err);
    }
  };

  // 友達申請一覧の取得
  const fetchFriendRequests = async (userId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/friend-requests?userId=${encodeURIComponent(userId)}`));
      const data = await readApiResponse<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>(res);
      setFriendRequests(data);
    } catch (err) {
      console.error('Error fetching friend requests:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Connect WebSocket
    wsService.connect();
    // 認証済みユーザーを関連付け（presence 用）
    if (account?.id) {
      wsService.identify(account.id);
    }

    // WS 接続/切断を isConnected に反映
    const unsubConn = wsService.onConnectionChange(setIsConnected);

    // 30秒毎にサーバーヘルスチェック（AbortController使用でAndroid WebViewも対応）
    const healthCheck = async () => {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch(apiUrl('/api/health'), { signal: ctrl.signal });
        setIsConnected(res.ok);
      } catch {
        setIsConnected(false);
      } finally {
        clearTimeout(tid);
      }
    };
    const healthTimer = setInterval(healthCheck, 30000);

    // WebSocket Event Listener
    const unsubscribe = wsService.subscribe((payload: WSMessagePayload) => {

      if (payload.type === 'init') {
        if (payload.onlineUsers) {
          setUsers((prev) =>
            prev.map((u) => ({ ...u, isOnline: payload.onlineUsers?.includes(u.id) }))
          );
        }
      } else if (payload.type === 'presence' && payload.userId) {
        // オンライン状態のリアルタイム更新
        setUsers((prev) =>
          prev.map((u) =>
            u.id === payload.userId
              ? { ...u, isOnline: !!payload.isOnline, lastSeen: payload.lastSeen || u.lastSeen }
              : u
          )
        );
      } else if (payload.type === 'user_update' && payload.user) {
        // プロフィール変更・友達関係更新の反映
        const updated = payload.user;
        setUsers((prev) => {
          if (prev.some((u) => u.id === updated.id)) {
            return prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u));
          }
          return [...prev, updated];
        });
      } else if (payload.type === 'friend_request') {
        // 友達申請の受信・状態変化。accountIdRef で最新 ID を参照（stale closure 回避）
        const currentId = accountIdRef.current;
        if (currentId) {
          const fr = payload.friendRequest;
          if (!fr || fr.fromUserId === currentId || fr.toUserId === currentId) {
            fetchFriendRequests(currentId);
            // 承認された場合は友達リスト等を更新
            if (fr && fr.status === 'accepted') {
              fetchData();
            }
          }
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
      } else if (payload.type === 'sync_result' && payload.messages) {
        // 再接続中に届いたメッセージを補完
        setRoomMessages((prev) => {
          const next = { ...prev };
          payload.messages!.forEach((msg) => {
            const existing = next[msg.roomId] || [];
            if (!existing.some((m) => m.id === msg.id)) {
              next[msg.roomId] = [...existing, msg];
            }
          });
          return next;
        });
      } else if (payload.type === 'delete_message' && payload.roomId && payload.messageId) {
        // 送信取消の反映
        setRoomMessages((prev) => {
          const roomMsgs = prev[payload.roomId!] || [];
          return {
            ...prev,
            [payload.roomId!]: roomMsgs.map((m) =>
              m.id === payload.messageId ? { ...m, deleted: true, content: '', reactions: {} } : m
            ),
          };
        });
      } else if (payload.type === 'reaction' && payload.roomId && payload.messageId) {
        // リアクション更新の反映
        setRoomMessages((prev) => {
          const roomMsgs = prev[payload.roomId!] || [];
          return {
            ...prev,
            [payload.roomId!]: roomMsgs.map((m) =>
              m.id === payload.messageId ? { ...m, reactions: payload.reactions || {} } : m
            ),
          };
        });
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
        setRooms((prev) => (prev.some((r) => r.id === newRoom.id) ? prev : [newRoom, ...prev]));
      }
    });

    return () => {
      unsubscribe();
      unsubConn();
      clearInterval(healthTimer);
    };
  }, [activeRoomId]);

  // Open Chat Room
  const handleOpenChat = (roomId: string) => {
    setActiveRoomId(roomId);
    setReplyingTo(null);

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

  // 過去メッセージの追加読み込み（ページネーション）
  const handleLoadOlderMessages = async (roomId: string): Promise<boolean> => {
    const current = roomMessages[roomId] || [];
    const oldest = current[0];
    if (!oldest) return false;
    try {
      const res = await fetch(
        apiUrl(`/api/rooms/${roomId}/messages?before=${encodeURIComponent(oldest.timestamp)}&limit=30`)
      );
      const data = await readApiResponse<{ messages: Message[]; hasMore: boolean }>(res);
      if (data.messages.length > 0) {
        setRoomMessages((prev) => {
          const existing = prev[roomId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const merged = [...data.messages.filter((m) => !existingIds.has(m.id)), ...existing];
          return { ...prev, [roomId]: merged };
        });
      }
      return data.hasMore;
    } catch (err) {
      console.error('Error loading older messages:', err);
      return false;
    }
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

    // 引用リプライがあれば付与
    if (replyingTo) {
      newMsg.replyTo = {
        messageId: replyingTo.id,
        senderName: replyingTo.senderName,
        type: replyingTo.type,
        preview: replyPreviewOf(replyingTo),
      };
    }

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

    setReplyingTo(null);
  };

  // リプライ元プレビュー文字列を生成
  const replyPreviewOf = (msg: Message): string => {
    switch (msg.type) {
      case 'image':
        return '画像';
      case 'video':
        return '動画';
      case 'sticker':
        return 'スタンプ';
      case 'voice':
        return 'ボイスメッセージ';
      default:
        return msg.content.slice(0, 40);
    }
  };

  // メッセージ送信取消（削除）
  const handleDeleteMessage = (messageId: string) => {
    if (!activeRoomId) return;
    wsService.send({
      type: 'delete_message',
      roomId: activeRoomId,
      messageId,
    });
  };

  // 絵文字リアクションのトグル
  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!activeRoomId) return;
    wsService.send({
      type: 'reaction',
      roomId: activeRoomId,
      messageId,
      emoji,
      userId: me.id,
    });
  };

  // Typing status emit（デバウンス付き）
  const handleSendTypingStatus = (isTyping: boolean) => {
    if (!activeRoomId) return;

    if (isTyping) {
      // 入力中: 立ち上がりのみ即送信し、停止は遅延で送る
      if (!lastTypingSentRef.current) {
        lastTypingSentRef.current = true;
        wsService.send({ type: 'typing', roomId: activeRoomId, userId: me.id, isTyping: true });
      }
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        lastTypingSentRef.current = false;
        wsService.send({ type: 'typing', roomId: activeRoomId, userId: me.id, isTyping: false });
      }, 2000);
    } else {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (lastTypingSentRef.current) {
        lastTypingSentRef.current = false;
        wsService.send({ type: 'typing', roomId: activeRoomId, userId: me.id, isTyping: false });
      }
    }
  };

  // 友達申請の送信
  const handleSendFriendRequest = async (toUserId: string) => {
    try {
      const res = await fetch(apiUrl('/api/friend-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: me.id, toUserId }),
      });
      if (res.ok) {
        fetchFriendRequests(me.id);
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
  };

  // 友達申請の承認
  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/friend-requests/${requestId}/accept`), { method: 'POST' });
      if (res.ok) {
        fetchFriendRequests(me.id);
        fetchData();
      }
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  // 友達申請の拒否
  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/friend-requests/${requestId}/reject`), { method: 'POST' });
      if (res.ok) {
        fetchFriendRequests(me.id);
      }
    } catch (err) {
      console.error('Error rejecting friend request:', err);
    }
  };

  // 友達申請のキャンセル
  const handleCancelFriendRequest = async (requestId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/friend-requests/${requestId}/cancel`), { method: 'POST' });
      if (res.ok) {
        fetchFriendRequests(me.id);
      }
    } catch (err) {
      console.error('Error canceling friend request:', err);
    }
  };

  // Add Friend
  const handleAddFriend = async (friendId: string) => {
    try {
      const res = await fetch(apiUrl('/api/users/add-friend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: me.id, friendId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error adding friend:', err);
    }
  };

  // Remove Friend
  const handleRemoveFriend = async (friendId: string) => {
    try {
      const res = await fetch(apiUrl('/api/users/remove-friend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: me.id, friendId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  // Create Room
  const handleCreateRoom = async (name: string, memberIds: string[], isGroup: boolean) => {
    try {
      // Auto add members as friends if not already
      for (const mId of memberIds) {
        if (!me.friendIds?.includes(mId)) {
          await handleAddFriend(mId);
        }
      }

      const res = await fetch(apiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, memberIds, isGroup, ownerId: me.id }),
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
      const res = await fetch(apiUrl('/api/users/profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: me.id, name, statusMessage, avatar }),
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
      await fetch(apiUrl('/api/seed/reset'), { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error('Error resetting database:', err);
    }
  };

  // アルバム・音楽からチャットへのシステム通知
  const handleSendSystemToRoom = (roomId: string, text: string) => {
    const newMsg = {
      id: `msg-sys-${Date.now()}`,
      roomId,
      senderId: me.id,
      senderName: me.name,
      senderAvatar: me.avatar,
      type: 'system' as const,
      content: text,
      timestamp: new Date().toISOString(),
      readBy: [me.id],
    };
    setRoomMessages((prev) => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), newMsg],
    }));
    wsService.send({ type: 'send_message', message: newMsg });
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
      {/* カバーモード: display:noneはaudioを停止させるためvisibility制御に変更 */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        visibility: appMode === 'solitaire' ? 'visible' : 'hidden',
        pointerEvents: appMode === 'solitaire' ? 'auto' : 'none',
      }}>
        <SolitaireGame onSecretCode={() => setAppMode('line')} />
      </div>

      {!account ? (
        /* 未ログイン時のガード画面 */
        <UnauthenticatedGuard
          onOpenAuthModal={(mode) => setAuthModalState({ isOpen: true, mode })}
        />
      ) : showSolitaire ? (
        <SolitaireGame onSecretCode={() => {}} onClose={() => setShowSolitaire(false)} />
      ) : activeRoomId && currentRoom ? (
        /* If Chat Room is Active, render full ChatRoom */
        <ChatRoomComponent
          room={currentRoom}
          currentUser={me}
          messages={roomMessages[activeRoomId] || []}
          onSendMessage={handleSendMessage}
          onBack={() => setActiveRoomId(null)}
          onStartCall={handleStartCall}
          isPartnerTyping={partnerTyping[activeRoomId] || false}
          onSendTypingStatus={handleSendTypingStatus}
          onDeleteMessage={handleDeleteMessage}
          onToggleReaction={handleToggleReaction}
          replyingTo={replyingTo}
          onSetReplyingTo={setReplyingTo}
          onLoadOlderMessages={handleLoadOlderMessages}
          chatSettings={chatSettings}
          onOpenAlbums={() => {
            setPreviousRoomId(activeRoomId);
            setActiveRoomId(null);
            setActiveTab('album');
          }}
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
              isLoggedIn={!!account}
              onOpenAuthModal={(mode = 'login') =>
                setAuthModalState({ isOpen: true, mode })
              }
              onSendFriendRequest={handleSendFriendRequest}
              onRemoveFriend={handleRemoveFriend}
              friendRequests={friendRequests}
              onAcceptFriendRequest={handleAcceptFriendRequest}
              onRejectFriendRequest={handleRejectFriendRequest}
              onCancelFriendRequest={handleCancelFriendRequest}
              onOpenSolitaire={() => setShowSolitaire(true)}
              isAdmin={!!account?.isAdmin}
              onRefreshUsers={fetchData}
              adminDebugLog={adminDebugLog}
            />
          )}

          {activeTab === 'chats' && (
            <ChatsTab
              rooms={rooms}
              currentUser={me}
              onOpenChat={handleOpenChat}
              onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
              onGoHome={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'album' && (
            <AlbumTab
              userId={account ? me.id : null}
              isLoggedIn={!!account}
              onOpenAuthModal={() => setAuthModalState({ isOpen: true, mode: 'login' })}
              onGoHome={() => {
                // チャットから開いた場合はチャットに戻る
                if (previousRoomId) {
                  setActiveRoomId(previousRoomId);
                  setPreviousRoomId(null);
                  setActiveTab('chats');
                } else {
                  setActiveTab('home');
                }
              }}
              rooms={rooms}
              onSendToChat={handleSendSystemToRoom}
              partnerUser={(() => {
                if (!previousRoomId) return null;
                const room = rooms.find(r => r.id === previousRoomId);
                return room?.members.find(m => m.id !== me.id) ?? null;
              })()}
            />
          )}

          {activeTab === 'music' && (
            <MusicTab
              isLoggedIn={!!account}
              onGoHome={() => setActiveTab('home')}
              rooms={rooms}
              onSendToChat={handleSendSystemToRoom}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              currentUser={me}
              accountEmail={account?.email}
              accountId={account?.id}
              isLoggedIn={!!account}
              isAdmin={!!account?.isAdmin}
              chatSettings={chatSettings}
              onChatSettingsChange={handleChatSettingsChange}
              onUpdateProfile={handleUpdateProfile}
              onResetDatabase={handleResetDatabase}
              onOpenAuthModal={(mode = 'login') =>
                setAuthModalState({ isOpen: true, mode })
              }
              onLogout={handleLogout}
              onLockApp={lockToSolitaire}
              isConnected={isConnected}
              onGoHome={() => setActiveTab('home')}
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
              onClick={() => setActiveTab('album')}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
                activeTab === 'album' ? 'text-[#00c300] font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Images className="w-5 h-5" />
              <span className="text-[10px]">アルバム</span>
            </button>

            <button
              onClick={() => setActiveTab('music')}
              className={`flex flex-col items-center gap-1 flex-1 py-1 transition ${
                activeTab === 'music' ? 'text-[#00c300] font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Music className="w-5 h-5" />
              <span className="text-[10px]">音楽</span>
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

      {/* Modals & Overlays Container */}
      <ModalsContainer
        isNewChatModalOpen={isNewChatModalOpen}
        users={users}
        currentUser={me}
        onCloseNewChatModal={() => setIsNewChatModalOpen(false)}
        onCreateRoom={handleCreateRoom}
        callState={callState}
        onEndCall={() => setCallState(null)}
        authModalState={authModalState}
        onCloseAuthModal={() => setAuthModalState((prev) => ({ ...prev, isOpen: false }))}
        onAuthSuccess={handleAuthSuccess}
      />
    </SmartphoneFrame>
  );
}
