import { WSMessagePayload } from '../types';
import { API_BASE_URL } from './api';

type Listener = (data: WSMessagePayload) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private userId: string | null = null;
  private lastMessageAt: string | null = null;
  private hasConnectedBefore = false;

  // 認証済みユーザーIDを登録。接続済みなら即 identify を送信
  public identify(userId: string) {
    this.userId = userId;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({ type: 'identify', userId });
    }
  }

  // 受信メッセージの最新時刻を記録（再接続時の欠損補完に使用）
  public trackMessageTime(timestamp: string) {
    if (!this.lastMessageAt || new Date(timestamp).getTime() > new Date(this.lastMessageAt).getTime()) {
      this.lastMessageAt = timestamp;
    }
  }

  public connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    const wsUrl = API_BASE_URL
      ? API_BASE_URL.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected to server');
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // ユーザーを再関連付け
        if (this.userId) {
          this.send({ type: 'identify', userId: this.userId });
        }

        // 再接続時は切断中に届いたメッセージを補完要求
        if (this.hasConnectedBefore && this.lastMessageAt) {
          this.send({ type: 'sync', since: this.lastMessageAt });
        }
        this.hasConnectedBefore = true;
      };

      this.socket.onmessage = (event) => {
        try {
          const payload: WSMessagePayload = JSON.parse(event.data);
          if (payload.message?.timestamp) {
            this.trackMessageTime(payload.message.timestamp);
          }
          this.listeners.forEach((listener) => listener(payload));
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed. Retrying in 3 seconds...');
        this.isConnecting = false;
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        this.isConnecting = false;
        this.socket?.close();
      };
    } catch (err) {
      console.error('Error instantiating WebSocket:', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 3000);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public send(payload: WSMessagePayload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      console.warn('WebSocket not connected. Payload not sent immediately.', payload);
      this.connect();
    }
  }
}

export const wsService = new WebSocketService();
