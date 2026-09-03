import React, { useState, useEffect } from 'react';
import { fetchRoomByUser, fetchRoomScores, fetchMyRoomScore, fetchWithAuth, clearTokens } from '../api/apicaller';
import { RoomMemberScoreItem } from '../index';

interface RoomHistoryItem {
  roomId: number;
  role: 'host' | 'participant';
  allScores?: RoomMemberScoreItem[];
  myScore?: RoomMemberScoreItem['score'];
  loading: boolean;
  error?: string;
}

interface ExamHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string; email: string } | null;
}

/**
 * Try to retroactively score an attempt for a participant whose mark is NULL.
 * Looks up exam_attempt_id from the room_member table via a dedicated query,
 * then calls scoreAttempt to compute and persist the mark into DB.
 * Returns the updated score or null if it can't be resolved.
 */
async function tryRetroactiveScore(roomId: number): Promise<RoomMemberScoreItem['score']> {
  try {
    // Get exam_attempt_id for this user+room via the attempt endpoint
    // We query the room_member table indirectly:
    // The my_room_score API reads from room_member -> exam_attempt -> mark.
    // If mark is null, we need the exam_attempt_id to call score_attempt.
    
    // Unfortunately there's no direct API to get exam_attempt_id by room+user.
    // But we CAN query by trying start_exam_attempt_by_room which will return
    // "Exam attempt already exists for this member: <id>" - we can parse that.
    const attemptRes = await fetchWithAuth('/api/start_exam_attempt_by_room', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId }),
    });
    
    if (!attemptRes.ok) {
      const errText = await attemptRes.text();
      // Parse: "Exam attempt already exists for this member: 72"
      const match = errText.match(/already exists for this member:\s*(\d+)/);
      if (match) {
        const attemptId = parseInt(match[1], 10);
        // Call score_attempt to compute and persist the mark
        const scoreRes = await fetchWithAuth(`/api/score_attempt?exam_attempt_id=${attemptId}`);
        if (scoreRes.ok) {
          const scoreData = await scoreRes.json();
          return { score: scoreData.score, sum_of_question: scoreData.sum_of_question };
        }
      }
    }
  } catch {
    // Silently fail
  }
  return null;
}

export const ExamHistoryModal: React.FC<ExamHistoryModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [historyList, setHistoryList] = useState<RoomHistoryItem[]>([]);
  const [selectedHostRoom, setSelectedHostRoom] = useState<RoomHistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState<boolean>(false);

  const loadHistory = () => {
    setLoading(true);
    setError(null);
    setIsAuthError(false);
    setSelectedHostRoom(null);

    fetchRoomByUser()
      .then(async (res) => {
        const roomIds = res.room_ids || [];
        if (roomIds.length === 0) {
          setHistoryList([]);
          setLoading(false);
          return;
        }

        // Initialize items with loading state
        const initialItems: RoomHistoryItem[] = roomIds.map(id => ({
          roomId: id,
          role: 'participant',
          loading: true,
        }));
        setHistoryList(initialItems);
        setLoading(false);

        // Fetch details for each room concurrently
        const updatedList: RoomHistoryItem[] = await Promise.all(
          roomIds.map(async (id) => {
            try {
              // 1. Try to fetch as Host (owner of the room)
              const hostScores = await fetchRoomScores(id);
              return {
                roomId: id,
                role: 'host' as const,
                allScores: hostScores.members || [],
                loading: false,
              };
            } catch {
              // 2. If not host, fetch as Participant
              try {
                const myScoreRes = await fetchMyRoomScore(id);
                let myScore = myScoreRes.score;

                // If score is null, mark was never written to DB.
                // Retroactively call scoreAttempt to compute and persist the mark.
                if (myScore === null) {
                  const retroScore = await tryRetroactiveScore(id);
                  if (retroScore) {
                    myScore = retroScore;
                  }
                }

                return {
                  roomId: id,
                  role: 'participant' as const,
                  myScore: myScore,
                  loading: false,
                };
              } catch (myErr: any) {
                return {
                  roomId: id,
                  role: 'participant' as const,
                  loading: false,
                  error: myErr.message || 'Không thể tải điểm',
                };
              }
            }
          })
        );

        setHistoryList(updatedList);
      })
      .catch((err) => {
        console.error('Failed to load room history:', err);
        const errMsg = err.message || '';
        if (errMsg.includes('JWT') || errMsg.includes('token') || errMsg.includes('Unauthorized') || errMsg.includes('403') || errMsg.includes('401')) {
          setIsAuthError(true);
          setError('Phiên đăng nhập đã hết hạn hoặc chưa có token xác thực.');
        } else {
          setError(errMsg || 'Không thể tải lịch sử phòng thi');
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const handleReLogin = () => {
    clearTokens();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="violation-modal-overlay" style={{ zIndex: 1000 }}>
      <div
        className="violation-modal-card"
        style={{
          maxWidth: '740px',
          width: '92%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          padding: '28px 24px',
          borderRadius: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Lịch Sử Phòng Thi
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Tài khoản: <strong>{currentUser?.username || 'Thí sinh'}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-surface-hover, rgba(0,0,0,0.05))',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontWeight: 700,
              cursor: 'pointer',
              color: 'var(--text-main)',
            }}
          >
            Đóng
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontWeight: 600 }}>
              Đang tải lịch sử phòng thi...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '24px 16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '16px' }}>
              <p style={{ color: '#ef4444', fontWeight: 700, margin: '0 0 12px 0' }}>{error}</p>
              {isAuthError ? (
                <button
                  type="button"
                  onClick={handleReLogin}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Đăng nhập lại
                </button>
              ) : (
                <button
                  type="button"
                  onClick={loadHistory}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Thử lại
                </button>
              )}
            </div>
          )}

          {!loading && !error && historyList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Chưa có lịch sử phòng thi
              </p>
              <p style={{ fontSize: '0.88rem', margin: 0 }}>
                Bạn chưa từng tạo hoặc tham gia phòng thi nào. Hãy vào mục "Phòng thi" để bắt đầu nhé!
              </p>
            </div>
          )}

          {!loading && historyList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historyList.map((item) => {
                const isHost = item.role === 'host';
                return (
                  <div
                    key={item.roomId}
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    {/* Left Info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          Phòng thi #{item.roomId}
                        </span>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isHost ? 'rgba(79, 70, 229, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: isHost ? 'var(--primary-color)' : '#22c55e',
                            border: `1px solid ${isHost ? 'rgba(79, 70, 229, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                          }}
                        >
                          {isHost ? 'Chủ phòng (Người tạo)' : 'Thí sinh tham gia'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        {isHost
                          ? 'Bạn là người tổ chức phòng này. Được phép xem bảng điểm toàn phòng.'
                          : 'Bạn tham gia làm bài trong phòng thi này.'}
                      </p>
                    </div>

                    {/* Right: Scores & Actions */}
                    <div>
                      {item.loading ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Đang tính điểm...</span>
                      ) : isHost ? (
                        <button
                          type="button"
                          onClick={() => setSelectedHostRoom(item)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--primary-color)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                          }}
                        >
                          Xem điểm toàn phòng ({item.allScores?.length || 0} thí sinh)
                        </button>
                      ) : (
                        <div style={{ textAlign: 'right' }}>
                          {item.myScore ? (
                            <div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {item.myScore.score} / {item.myScore.sum_of_question} câu
                              </div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: (item.myScore.score / (item.myScore.sum_of_question || 1)) >= 0.5 ? '#22c55e' : '#ef4444' }}>
                                Đạt {item.myScore.sum_of_question > 0 ? Math.round((item.myScore.score / item.myScore.sum_of_question) * 100) : 0}%
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Chưa có điểm / Chưa nộp
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* -- NESTED HOST ALL PARTICIPANTS SCORE MODAL -- */}
        {selectedHostRoom && selectedHostRoom.allScores && (
          <div className="violation-modal-overlay" style={{ zIndex: 1100 }}>
            <div
              className="violation-modal-card"
              style={{
                maxWidth: '640px',
                width: '90%',
                maxHeight: '85vh',
                overflowY: 'auto',
                textAlign: 'center',
                padding: '28px 20px',
              }}
            >
              <div style={{ display: 'inline-block', background: 'rgba(79, 70, 229, 0.15)', color: 'var(--primary-color)', padding: '4px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '0.82rem', marginBottom: '10px' }}>
                BẢNG ĐIỂM CHỦ PHÒNG
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                Kết Quả Phòng Thi #{selectedHostRoom.roomId}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '18px' }}>
                Tổng số học sinh tham gia: <strong>{selectedHostRoom.allScores.length}</strong>
              </p>

              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 700 }}>Hạng</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700 }}>Thí sinh</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>Điểm số</th>
                      <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHostRoom.allScores
                      .slice()
                      .sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0))
                      .map((member, idx) => {
                        const scoreVal = member.score?.score ?? 0;
                        const sumVal = member.score?.sum_of_question ?? 0;
                        const percent = sumVal > 0 ? Math.round((scoreVal / sumVal) * 100) : 0;
                        return (
                          <tr key={member.user_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px', fontWeight: 700 }}>
                              #{idx + 1}
                            </td>
                            <td style={{ padding: '10px', fontWeight: 600 }}>
                              Học sinh ID: {member.user_id}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>
                              {member.score ? `${scoreVal} / ${sumVal}` : 'Chưa có điểm'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {member.score ? (
                                <span style={{ fontWeight: 700, color: percent >= 50 ? '#22c55e' : '#ef4444' }}>
                                  {percent}%
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={() => setSelectedHostRoom(null)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary-color)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Đóng bảng điểm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
