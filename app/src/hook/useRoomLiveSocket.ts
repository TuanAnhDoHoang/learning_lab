import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from '../api/apicaller';
import { RoomLiveSnapshotPayload } from '..';

export interface UseRoomLiveSocketReturn {
  snapshot: RoomLiveSnapshotPayload | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => void;
}

export const useRoomLiveSocket = (
  roomId: number | undefined | null,
  enabled: boolean = true
): UseRoomLiveSocketReturn => {
  const [snapshot, setSnapshot] = useState<RoomLiveSnapshotPayload | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Lưu trữ tham chiếu WebSocket và Timer để dọn dẹp an toàn
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef<boolean>(false);

  // Hàm tạo URL WebSocket kèm Access Token
  const getSocketUrl = useCallback(() => {
    const token = getAccessToken();
    if (!token || !roomId) return null;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Backend chạy ở cổng 3000
    const host = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
    return `${protocol}//${host}/api/room_live_answers?room_id=${roomId}&access_token=${encodeURIComponent(token)}`;
  }, [roomId]);

  // Hàm kết nối WebSocket
  const connect = useCallback(() => {
    if (!enabled || !roomId) return;

    const url = getSocketUrl();
    if (!url) {
      setError('Thiếu Access Token hoặc mã phòng thi');
      return;
    }

    // Nếu đang có socket cũ, đóng trước khi mở mới
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        retryCountRef.current = 0; // Đặt lại số lần thử khi đã kết nối thành công
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isUnmountedRef.current) return;
        try {
          const data: RoomLiveSnapshotPayload = JSON.parse(event.data);
          setSnapshot(data);
        } catch (err) {
          console.warn('Lỗi phân tích cú pháp gói tin WebSocket:', err);
        }
      };

      ws.onerror = (err: Event) => {
        if (isUnmountedRef.current) return;
        console.error('Lỗi kết nối WebSocket:', err);
        setError('Lỗi kết nối tới luồng giám sát');
      };

      ws.onclose = (event: CloseEvent) => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Nếu ngắt đột ngột (không phải do client chủ động đóng mã 1000)
        // và component vẫn đang hiển thị, tự động thử kết nối lại
        if (event.code !== 1000 && enabled) {
          const maxRetryDelay = 15000;
          // Cơ chế Backoff: 2s -> 4s -> 8s -> tối đa 15s
          const delay = Math.min(2000 * Math.pow(1.5, retryCountRef.current), maxRetryDelay);
          retryCountRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, delay);
        }
      };
    } catch (err: any) {
      setIsConnecting(false);
      setError(err.message || 'Không thể khởi tạo WebSocket');
    }
  }, [enabled, roomId, getSocketUrl]);

  // Kích hoạt kết nối khi roomId thay đổi hoặc component được mount
  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    // Dọn dẹp khi rời khỏi trang (Unmount)
    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Trả về đối tượng quản lý cho UI
  return {
    snapshot,
    isConnected,
    isConnecting,
    error,
    reconnect: connect,
  };
};