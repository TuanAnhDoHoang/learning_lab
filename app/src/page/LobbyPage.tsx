import React, { useState, useEffect, useCallback } from 'react';
import { startRoom, startExamAttemptByRoom, fetchWithAuth, leaveRoom, deleteRoom } from '../api/apicaller';
import { ExamContent } from '../index';

interface LobbyPageProps {
  roomId: number;
  roomCode: string;
  isHost: boolean;
  hostRole?: 'proctor' | 'participant';
  onHostStartProctor: (roomId: number, roomCode: string, mems: number[]) => void;
  onExamStarted: (attemptId: number, examContent: ExamContent, isHostAttempt?: boolean) => void;
  onLeave: () => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ 
  roomId, roomCode, isHost, hostRole = 'proctor', onHostStartProctor, onExamStarted, onLeave 
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Poll member count for host (uses room_scores endpoint which returns member list)
  const fetchMemberCount = useCallback(async () => {
    if (!isHost) return;
    try {
      const res = await fetchWithAuth('/api/room_scores', {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out the host if they are also a member (participant mode)
        setMemberCount(data.members?.length || 0);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [isHost, roomId]);

  useEffect(() => {
    if (!isHost) return;
    fetchMemberCount();
    const interval = setInterval(fetchMemberCount, 4000);
    return () => clearInterval(interval);
  }, [isHost, fetchMemberCount]);

  // Participant polling logic
  useEffect(() => {
    if (isHost) return;

    const interval = setInterval(async () => {
      try {
        const res = await startExamAttemptByRoom(roomId);
        // If successful, it means the room started
        clearInterval(interval);
        onExamStarted(res.exam_attempt_id, res.exam_content, false);
      } catch (err: any) {
        // 1. Phòng thi chưa bắt đầu (HTTP 403 "Room have not start yet"): Tiếp tục chờ bình thường
        if (err.status === 403 || (err.message && err.message.toLowerCase().includes('not start yet'))) {
          return;
        }

        // 2. Phòng thi thực sự bị xóa / không tìm thấy: Báo lỗi và rời phòng
        if (err.status === 404 || (err.message && err.message.toLowerCase().includes('not found'))) {
          clearInterval(interval);
          alert('Phòng thi đã bị chủ phòng hủy.');
          onLeave();
          return;
        }

        // Lỗi khác: Ghi log và tiếp tục thử lại
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isHost, roomId, onExamStarted]);

  const handleHostStartClick = () => {
    // Determine minimum members needed
    // If host is participant, they are already counted as a member,
    // so we need at least 1 member (themselves). For proctor mode, need at least 1 student.
    const minRequired = hostRole === 'participant' ? 1 : 0;

    if (memberCount <= minRequired) {
      // Show confirmation dialog when no other students have joined
      setShowConfirm(true);
    } else {
      handleHostStart();
    }
  };

  const handleHostStart = async () => {
    setShowConfirm(false);
    setError(null);
    setIsStarting(true);
    try {
      const res = await startRoom({ room_id: roomId });
      if (hostRole === 'participant') {
        const attemptRes = await startExamAttemptByRoom(roomId);
        onExamStarted(attemptRes.exam_attempt_id, attemptRes.exam_content, true);
      } else {
        onHostStartProctor(roomId, roomCode, res.mems || []);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi bắt đầu phòng thi');
      setIsStarting(false);
    }
  };

  const [isLeaving, setIsLeaving] = useState(false);

  const handleDeleteRoom = async () => {
    setShowDeleteConfirm(false);
    setIsLeaving(true);
    try {
      await deleteRoom(roomId);
    } catch (err: any) {
      console.warn('deleteRoom error:', err);
    } finally {
      setIsLeaving(false);
      onLeave();
    }
  };

  const handleLeaveRoom = async () => {
    // If participant (or host in participant role), call leave_room API to remove user from room_members on server
    if (!isHost || hostRole === 'participant') {
      setIsLeaving(true);
      try {
        await leaveRoom({ room_code: roomCode });
      } catch (err: any) {
        console.warn('leaveRoom error:', err);
      } finally {
        setIsLeaving(false);
        onLeave();
      }
    } else {
      onLeave();
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      alert('Đã copy mã phòng!');
    } catch (err) {
      alert('Không thể copy mã phòng, vui lòng copy thủ công.');
    }
  };

  return (
    <div className="lobby-page-wrapper">
      <div className="lobby-card">
        <h2>Phòng Chờ (Lobby)</h2>
        <div className="lobby-room-code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          Mã phòng: <strong>{roomCode}</strong>
          <button onClick={handleCopyCode} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid currentColor', background: 'transparent', color: 'inherit', fontWeight: 'bold' }}>Copy</button>
        </div>

        {/* Member count indicator for host */}
        {isHost && (
          <div style={{
            margin: '16px auto',
            padding: '10px 20px',
            background: 'var(--bg-surface, #f5f3ff)',
            borderRadius: '8px',
            textAlign: 'center',
            fontSize: '0.95rem',
            fontWeight: 600,
            border: '1px solid var(--border-color, #e2e8f0)',
            maxWidth: '320px',
          }}>
            Thành viên đã tham gia: <strong style={{ color: 'var(--primary-color, #4f46e5)', fontSize: '1.1rem' }}>{memberCount}</strong>
          </div>
        )}
        
        {error && <div className="room-alert error">{error}</div>}

        {/* Confirmation dialog */}
        {showConfirm && (
          <div style={{
            margin: '12px auto',
            padding: '16px',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#856404' }}>
              {memberCount === 0
                ? 'Chưa có thành viên nào tham gia phòng thi. Bạn có chắc muốn bắt đầu không?'
                : 'Hiện tại chỉ có bạn trong phòng. Bạn có chắc muốn bắt đầu không?'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleHostStart}
                disabled={isStarting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--primary-color, #4f46e5)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isStarting ? 'Đang khởi động...' : 'Vẫn bắt đầu'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #ccc)',
                  background: 'transparent',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đợi thêm
              </button>
            </div>
          </div>
        )}

        {showDeleteConfirm && isHost && (
          <div style={{
            margin: '12px auto',
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            maxWidth: '420px',
            textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#ef4444' }}>
              Bạn có chắc chắn muốn hủy và xóa phòng thi này không? Toàn bộ thí sinh đang đợi sẽ bị ngắt kết nối.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handleDeleteRoom}
                disabled={isLeaving}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isLeaving ? 'Đang hủy...' : 'Xác nhận hủy phòng'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #ccc)',
                  background: 'transparent',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        <div className="lobby-content">
          {isHost ? (
            <div className="host-view">
              <p>Bạn là chủ phòng. Hãy chia sẻ mã phòng cho học sinh.</p>
              <p>Khi tất cả đã sẵn sàng, hãy bấm nút dưới đây để bắt đầu.</p>
              <button 
                className="btn-start-room" 
                onClick={handleHostStartClick}
                disabled={isStarting || showConfirm || showDeleteConfirm}
              >
                {isStarting ? 'Đang khởi động...' : 'Bắt đầu thi ngay'}
              </button>
            </div>
          ) : (
            <div className="participant-view">
              <div className="spinner"></div>
              <p>Đang chờ giáo viên bắt đầu bài thi...</p>
              <p className="sub-text">Vui lòng không đóng trình duyệt. Bài thi sẽ tự động bắt đầu.</p>
            </div>
          )}
        </div>

        {!isStarting && (
          isHost ? (
            <button 
              type="button"
              className="btn-leave-room" 
              style={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.05)',
              }}
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLeaving}
            >
              {isLeaving ? 'Đang hủy phòng...' : 'Hủy & Xóa phòng thi'}
            </button>
          ) : (
            <button 
              type="button"
              className="btn-leave-room" 
              onClick={handleLeaveRoom}
              disabled={isLeaving}
            >
              {isLeaving ? 'Đang rời phòng...' : 'Rời phòng'}
            </button>
          )
        )}
      </div>
    </div>
  );
};
