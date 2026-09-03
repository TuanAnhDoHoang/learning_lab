import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CandidateProgress, ProctorActivityEvent, CustomExamData, CandidateLiveState, RoomMemberScoreItem } from '..';
import { fetchQuestions, closeRoom, fetchRoomScores } from '../api/apicaller';

interface ProctorDashboardProps {
  roomId?: number;
  examId?: number;
  roomCode: string;
  roomTitle: string;
  examName: string;
  customExamData?: CustomExamData | null;
  durationMinutes: number;
  initialTimeLeftSeconds?: number;
  enableAntiCheat: boolean;
  participants: string[];
  currentUser: { username: string; email: string; userid?: number } | null;
  onEndExam: () => void;
  onBackToHome: () => void;
}

export const ProctorDashboard: React.FC<ProctorDashboardProps> = ({
  roomId,
  examId,
  roomCode,
  roomTitle,
  examName,
  customExamData,
  durationMinutes = 15,
  initialTimeLeftSeconds,
  enableAntiCheat = true,
  participants,
  currentUser,
  onEndExam,
  onBackToHome,
}) => {
  const totalDurationSeconds = initialTimeLeftSeconds !== undefined
    ? Math.max(0, initialTimeLeftSeconds)
    : durationMinutes * 60;
  const [timeLeft, setTimeLeft] = useState<number>(totalDurationSeconds);
  const [isExamFinished, setIsExamFinished] = useState<boolean>(totalDurationSeconds <= 0);
  const [isEndingRoom, setIsEndingRoom] = useState<boolean>(false);
  const [finalScores, setFinalScores] = useState<RoomMemberScoreItem[] | null>(null);
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [totalQuestions, setTotalQuestions] = useState<number>(() => customExamData?.questions?.length || 0);

  // Fetch real questions for proctor from backend if examId is present
  useEffect(() => {
    if (examId && examId > 0) {
      fetchQuestions(examId)
        .then((res: any) => {
          if (res?.questions) {
            const count = res.questions.length;
            setTotalQuestions(count);
            setCandidates(prev => prev.map(c => ({
              ...c,
              totalQuestions: count
            })));
          }
        })
        .catch((err: any) => {
          console.error('Failed to fetch questions for proctor:', err);
        });
    } else if (customExamData?.questions?.length) {
      const count = customExamData.questions.length;
      setTotalQuestions(count);
      setCandidates(prev => prev.map(c => ({
        ...c,
        totalQuestions: count
      })));
    }
  }, [examId, customExamData]);

  // Selected candidate for sending warning modal
  const [warningModalCandidate, setWarningModalCandidate] = useState<CandidateProgress | null>(null);
  const [warningInputText, setWarningInputText] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filter tab for candidates table
  const [filterState, setFilterState] = useState<'all' | 'active' | 'offline' | 'warning' | 'submitted'>('all');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 3500);
  };

  /* ── Initial Candidates State ── */
  const [candidates, setCandidates] = useState<CandidateProgress[]>(() => {
    const list = participants.length > 0
      ? participants.filter(p => p !== currentUser?.username && p !== 'Chủ phòng')
      : ['Nguyễn Văn A', 'Trần Thị B', 'Lê Hoàng C', 'Phạm Minh D', 'Đỗ Quỳnh E'];

    return list.map((name, idx) => ({
      id: `cand-${idx + 1}`,
      name,
      state: 'active' as CandidateLiveState,
      answeredCount: 0,
      totalQuestions,
      violationsCount: 0,
      violationsList: [],
      lastHeartbeat: 'Vừa xong',
      timeSpentSeconds: 0,
      bonusMinutesAdded: 0,
    }));
  });

  /* ── Live Incident & Activity Log Feed ── */
  const [activityLogs, setActivityLogs] = useState<ProctorActivityEvent[]>([
    {
      id: 1,
      timestamp: new Date().toLocaleTimeString(),
      candidateName: 'Hệ thống',
      type: 'info',
      message: `Bắt đầu phiên thi phòng ${roomCode}. Đề thi: "${examName}" (${durationMinutes} phút).`,
    },
  ]);

  const addActivityLog = (candidateName: string, type: ProctorActivityEvent['type'], message: string) => {
    const newEvent: ProctorActivityEvent = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      candidateName,
      type,
      message,
    };
    setActivityLogs(prev => [newEvent, ...prev.slice(0, 49)]); // keep last 50
  };

  // 4. End room, score all students, and show final score table
  const finishAndShowScores = useCallback(async () => {
    setIsEndingRoom(true);
    try {
      if (roomId && roomId > 0) {
        // 1. Close room and auto-score unsubmitted attempts on server
        await closeRoom(roomId).catch(() => {});
        addActivityLog('Hệ thống', 'info', 'Đã gửi lệnh đóng phòng thi. Hệ thống đang tổng hợp điểm số...');

        // 2. Fetch final room scores
        const res = await fetchRoomScores(roomId);
        if (res && res.members) {
          setFinalScores(res.members);
          setShowScoreModal(true);
          setIsExamFinished(true);
          addActivityLog('Hệ thống', 'success', `Đã lấy thành công bảng điểm của ${res.members.length} thí sinh.`);
        }
      } else {
        // Fallback for local/demo test
        setIsExamFinished(true);
        const mockMembers: RoomMemberScoreItem[] = candidates.map((c, idx) => ({
          user_id: idx + 101,
          score: {
            score: c.score !== undefined ? c.score : Math.min(c.answeredCount, totalQuestions),
            sum_of_question: totalQuestions || 10,
          },
        }));
        setFinalScores(mockMembers);
        setShowScoreModal(true);
      }
    } catch (err: any) {
      console.error('Failed to close room and get scores:', err);
      showToast(`Có lỗi khi kết thúc phòng thi: ${err.message || err}`);
      setIsExamFinished(true);
    } finally {
      setIsEndingRoom(false);
    }
  }, [roomId, candidates, totalQuestions]);

  // If initialTimeLeftSeconds is already <= 0 upon mounting, immediately show final scores
  useEffect(() => {
    if (initialTimeLeftSeconds !== undefined && initialTimeLeftSeconds <= 0) {
      finishAndShowScores();
    }
  }, [initialTimeLeftSeconds, finishAndShowScores]);

  // Load real members for the room
  useEffect(() => {
    if (roomId && roomId > 0) {
      fetchRoomScores(roomId)
        .then(res => {
          if (res.members && res.members.length > 0) {
            setCandidates(res.members.map((m) => ({
              id: `cand-${m.user_id}`,
              name: m.user_id === currentUser?.userid ? `${currentUser?.username || 'Bạn'} (Chủ phòng)` : `Học sinh ID: ${m.user_id}`,
              state: m.score ? ('submitted' as CandidateLiveState) : ('active' as CandidateLiveState),
              answeredCount: m.score ? m.score.score : 0,
              totalQuestions: totalQuestions || 10,
              violationsCount: 0,
              violationsList: [],
              lastHeartbeat: 'Vừa xong',
              timeSpentSeconds: 0,
              score: m.score?.score,
              bonusMinutesAdded: 0,
            })));
          }
        })
        .catch(() => {});
    }
  }, [roomId, totalQuestions, currentUser]);

  /* ── Room Countdown Timer ── */
  useEffect(() => {
    if (isExamFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsExamFinished(true);
          addActivityLog('Hệ thống', 'info', 'Thời gian làm bài của phòng thi đã kết thúc. Toàn bộ bài làm đã được thu tự động.');
          finishAndShowScores();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamFinished, finishAndShowScores]);

  /* ── No more Realistic Live Simulation of Student Actions & Heartbeat Events ── */
  useEffect(() => {
    if (isExamFinished) return;
    // Mock simulation removed as requested by user.
  }, [isExamFinished, totalQuestions, enableAntiCheat]);


  /* ── Proctor Actions ── */

  // 1. Send Warning to Candidate
  const handleSendWarning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningModalCandidate) return;

    const message = warningInputText.trim() || 'Giám thị nhắc nhở: Vui lòng tập trung làm bài và giữ cửa sổ bài thi ở chế độ toàn màn hình!';
    addActivityLog(warningModalCandidate.name, 'warning', `Giám thị đã gửi tin nhắn nhắc nhở: "${message}"`);
    showToast(`Đã gửi tin nhắn cảnh báo tới thí sinh ${warningModalCandidate.name}.`);

    setWarningModalCandidate(null);
    setWarningInputText('');
  };

  // 2. Add Compensation Time (+ Bonus Minutes) for network/power outages
  const handleAddBonusTime = (candidateId: string, minutes: number) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        const added = (c.bonusMinutesAdded || 0) + minutes;
        addActivityLog(c.name, 'success', `Giám thị đã cộng bù thêm ${minutes} phút làm bài do sự cố gián đoạn kỹ thuật.`);
        showToast(`Đã cộng bù ${minutes} phút cho thí sinh ${c.name}.`);
        return { ...c, bonusMinutesAdded: added };
      }
      return c;
    }));
  };

  // 3. Force Disqualify / Lock Exam for candidate
  const handleDisqualifyCandidate = (candidateId: string) => {
    setCandidates(prev => prev.map(c => {
      if (c.id === candidateId) {
        addActivityLog(c.name, 'danger', `Giám thị đã trực tiếp TRUẤT QUYỀN THI do vi phạm quy chế nghiêm trọng.`);
        showToast(`Đã khóa bài thi và truất quyền thí sinh ${c.name}.`);
        return { ...c, state: 'disqualified', score: 0 };
      }
      return c;
    }));
  };

  // 4. Manual end room button (asks for confirmation)
  const handleEndRoom = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc buổi thi và thu bài của tất cả thí sinh ngay bây giờ?')) {
      return;
    }
    await finishAndShowScores();
  };

  // Format time mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Statistics calculation
  const totalCount = candidates.length;
  const activeCount = candidates.filter(c => c.state === 'active' || c.state === 'blurred').length;
  const offlineCount = candidates.filter(c => c.state === 'offline').length;
  const submittedCount = candidates.filter(c => c.state === 'submitted').length;
  const violationCount = candidates.filter(c => c.violationsCount > 0 || c.state === 'disqualified').length;

  // Filtered list
  const filteredCandidates = candidates.filter(c => {
    if (filterState === 'active') return c.state === 'active' || c.state === 'blurred';
    if (filterState === 'offline') return c.state === 'offline';
    if (filterState === 'warning') return c.violationsCount > 0 || c.state === 'disqualified';
    if (filterState === 'submitted') return c.state === 'submitted';
    return true;
  });

  return (
    <div className="proctor-dashboard-root">
      {/* Toast */}
      {toastMsg && (
        <div className="exam-toast">
          {toastMsg}
        </div>
      )}

      {/* ── FINAL SCORES SUMMARY MODAL ── */}
      {showScoreModal && finalScores && (
        <div className="violation-modal-overlay">
          <div
            className="violation-modal-card"
            style={{
              maxWidth: '680px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              textAlign: 'center',
              padding: '32px 24px',
            }}
          >
            <div style={{ display: 'inline-block', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '4px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '0.82rem', marginBottom: '12px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              PHÒNG THI ĐÃ KẾT THÚC
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
              Bảng Điểm Tổng Kết Phòng Thi
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Mã phòng: <strong>{roomCode}</strong> | Đề: <strong>{examName}</strong> | Tổng thí sinh: <strong>{finalScores.length}</strong>
            </p>

            <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Hạng</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Thí sinh</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Điểm số</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Tỷ lệ</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, textAlign: 'center' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {finalScores
                    .slice()
                    .sort((a, b) => (b.score?.score || 0) - (a.score?.score || 0))
                    .map((item, idx) => {
                      const scoreVal = item.score?.score ?? 0;
                      const sumVal = item.score?.sum_of_question ?? totalQuestions ?? 0;
                      const percent = sumVal > 0 ? Math.round((scoreVal / sumVal) * 100) : 0;
                      return (
                        <tr key={item.user_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px', fontWeight: 700, color: idx === 0 ? '#eab308' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'inherit' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>
                            Học sinh ID: {item.user_id}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700 }}>
                            {scoreVal} / {sumVal}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: percent >= 50 ? '#22c55e' : '#ef4444' }}>
                              {percent}%
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.8rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontWeight: 600 }}>
                              Đã nộp bài
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowScoreModal(false);
                  onEndExam();
                }}
                style={{
                  padding: '12px 28px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary-color)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Warning Message Modal ── */}
      {warningModalCandidate && (
        <div className="violation-modal-overlay">
          <div className="violation-modal-card">
            <h3>GỬI NHẮC NHỞ TỚI THÍ SINH</h3>
            <p className="violation-desc">
              Thí sinh: <strong>{warningModalCandidate.name}</strong> (Số lần vi phạm: {warningModalCandidate.violationsCount}/3)
            </p>
            <form onSubmit={handleSendWarning}>
              <textarea
                rows={3}
                className="proctor-warning-textarea"
                placeholder="Nhập nội dung nhắc nhở thí sinh..."
                value={warningInputText}
                onChange={e => setWarningInputText(e.target.value)}
              />
              <div className="exit-modal-actions-row" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-danger-exit"
                  onClick={() => setWarningModalCandidate(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-continue-exam"
                  style={{ background: 'var(--primary-color)' }}
                >
                  Gửi cảnh báo ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Header Bar ── */}
      <header className="proctor-header-bar">
        <div className="proctor-header-left">
          <div className="proctor-live-badge">
            <span className="proctor-pulse-dot"></span>
            LIVE PROCTORING
          </div>
          <div className="proctor-room-info">
            <h2>{roomTitle}</h2>
            <div className="proctor-meta-tags">
              <span className="proctor-code-tag">Mã phòng: <strong>{roomCode}</strong></span>
              <span className="proctor-exam-tag">Đề: <strong>{examName}</strong></span>
              {enableAntiCheat && <span className="proctor-shield-tag">Giám sát Anti-Cheat: BẬT</span>}
            </div>
          </div>
        </div>

        <div className="proctor-header-right">
          <div className={`proctor-timer-box ${timeLeft <= 120 ? 'urgent' : ''}`}>
            <span className="p-timer-label">THỜI GIAN CÒN LẠI</span>
            <span className="p-timer-value">{formatTime(timeLeft)}</span>
          </div>

          <button
            className="btn-end-proctor"
            onClick={handleEndRoom}
            disabled={isEndingRoom}
          >
            {isEndingRoom ? 'Đang tổng hợp điểm...' : 'Kết thúc phòng thi'}
          </button>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="proctor-main-container container">
        {/* KPI Stat Cards */}
        <section className="proctor-stats-grid">
          <div className="proctor-stat-card" onClick={() => setFilterState('all')}>
            <div className="stat-value">{totalCount}</div>
            <div className="stat-label">Tổng số thí sinh</div>
          </div>
          <div className={`proctor-stat-card active ${filterState === 'active' ? 'selected' : ''}`} onClick={() => setFilterState('active')}>
            <div className="stat-value text-green">{activeCount}</div>
            <div className="stat-label">Đang làm bài</div>
          </div>
          <div className={`proctor-stat-card offline ${filterState === 'offline' ? 'selected' : ''}`} onClick={() => setFilterState('offline')}>
            <div className="stat-value text-orange">{offlineCount}</div>
            <div className="stat-label">Mất kết nối (Offline)</div>
          </div>
          <div className={`proctor-stat-card warning ${filterState === 'warning' ? 'selected' : ''}`} onClick={() => setFilterState('warning')}>
            <div className="stat-value text-red">{violationCount}</div>
            <div className="stat-label">Cảnh báo / Vi phạm</div>
          </div>
          <div className={`proctor-stat-card submitted ${filterState === 'submitted' ? 'selected' : ''}`} onClick={() => setFilterState('submitted')}>
            <div className="stat-value text-blue">{submittedCount}</div>
            <div className="stat-label">Đã hoàn thành</div>
          </div>
        </section>

        {/* 2-Column Layout: Candidates Table + Live Activity Feed */}
        <div className="proctor-layout-grid">
          {/* Left: Live Candidates Table */}
          <section className="proctor-table-section">
            <div className="section-header-row">
              <h3>Danh Sách Thí Sinh Theo Dõi Trực Tiếp ({filteredCandidates.length})</h3>
              <div className="filter-pills">
                <button className={`pill-btn ${filterState === 'all' ? 'active' : ''}`} onClick={() => setFilterState('all')}>Tất cả</button>
                <button className={`pill-btn ${filterState === 'active' ? 'active' : ''}`} onClick={() => setFilterState('active')}>Đang thi</button>
                <button className={`pill-btn ${filterState === 'offline' ? 'active' : ''}`} onClick={() => setFilterState('offline')}>Mất mạng</button>
                <button className={`pill-btn ${filterState === 'warning' ? 'active' : ''}`} onClick={() => setFilterState('warning')}>Có vi phạm</button>
                <button className={`pill-btn ${filterState === 'submitted' ? 'active' : ''}`} onClick={() => setFilterState('submitted')}>Đã nộp</button>
              </div>
            </div>

            <div className="proctor-table-container">
              <table className="proctor-table">
                <thead>
                  <tr>
                    <th>Thí sinh</th>
                    <th>Trạng thái trực tiếp</th>
                    <th>Tiến độ bài làm</th>
                    <th>Vi phạm Anti-Cheat</th>
                    <th>Tín hiệu cuối</th>
                    <th>Thao tác giám thị</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map(cand => {
                    const percent = cand.totalQuestions > 0 ? Math.round((cand.answeredCount / cand.totalQuestions) * 100) : 0;

                    return (
                      <tr key={cand.id} className={`cand-row state-${cand.state}`}>
                        {/* Candidate Info */}
                        <td className="cand-info-cell">
                          <div className="cand-avatar">{cand.name.charAt(0).toUpperCase()}</div>
                          <div className="cand-name-wrap">
                            <strong>{cand.name}</strong>
                            {cand.bonusMinutesAdded && cand.bonusMinutesAdded > 0 ? (
                              <span className="bonus-time-tag">+{cand.bonusMinutesAdded}p bù giờ</span>
                            ) : null}
                          </div>
                        </td>

                        {/* Live State Badge */}
                        <td className="cand-state-cell">
                          {cand.state === 'active' && (
                            <span className="status-badge live-active">
                              <span className="pulse-green"></span> Đang làm bài
                            </span>
                          )}
                          {cand.state === 'blurred' && (
                            <span className="status-badge live-blurred">
                              Mất tiêu điểm (Ân hạn)
                            </span>
                          )}
                          {cand.state === 'offline' && (
                            <span className="status-badge live-offline" title="Mất kết nối Internet hoặc tắt máy">
                              Mất kết nối (Offline)
                            </span>
                          )}
                          {cand.state === 'submitted' && (
                            <span className="status-badge live-submitted">
                              Đã nộp ({cand.score}/{cand.totalQuestions})
                            </span>
                          )}
                          {cand.state === 'disqualified' && (
                            <span className="status-badge live-disqualified">
                              Đã bị truất quyền
                            </span>
                          )}
                        </td>

                        {/* Progress Bar */}
                        <td className="cand-progress-cell">
                          <div className="progress-bar-wrap">
                            <div className="progress-bar-track">
                              <div
                                className={`progress-bar-fill ${cand.state === 'submitted' ? 'full' : ''}`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                            <span className="progress-text">{cand.answeredCount}/{cand.totalQuestions} ({percent}%)</span>
                          </div>
                        </td>

                        {/* Violation Counter */}
                        <td className="cand-violation-cell">
                          {cand.violationsCount === 0 ? (
                            <span className="badge-clean">0 vi phạm</span>
                          ) : cand.violationsCount < 3 ? (
                            <span className="badge-violation-warn">{cand.violationsCount}/3 vi phạm</span>
                          ) : (
                            <span className="badge-violation-danger">3/3 (Khóa bài)</span>
                          )}
                        </td>

                        {/* Heartbeat Pulse */}
                        <td className="cand-heartbeat-cell">
                          <span className="heartbeat-text">{cand.lastHeartbeat}</span>
                        </td>

                        {/* Proctor Action Buttons */}
                        <td className="cand-actions-cell">
                          <div className="proctor-action-btns">
                            <button
                              type="button"
                              className="btn-p-action warn"
                              title="Gửi tin nhắn nhắc nhở trực tiếp"
                              onClick={() => {
                                setWarningModalCandidate(cand);
                                setWarningInputText('');
                              }}
                              disabled={cand.state === 'submitted' || cand.state === 'disqualified'}
                            >
                              Nhắc nhở
                            </button>

                            <button
                              type="button"
                              className="btn-p-action bonus"
                              title="Cộng thêm 2 phút bù sự cố mất mạng"
                              onClick={() => handleAddBonusTime(cand.id, 2)}
                              disabled={cand.state === 'submitted' || cand.state === 'disqualified'}
                            >
                              +2p bù
                            </button>

                            <button
                              type="button"
                              className="btn-p-action kick"
                              title="Truất quyền làm bài thí sinh này"
                              onClick={() => {
                                if (window.confirm(`Bạn có chắc chắn muốn truất quyền làm bài của ${cand.name}?`)) {
                                  handleDisqualifyCandidate(cand.id);
                                }
                              }}
                              disabled={cand.state === 'submitted' || cand.state === 'disqualified'}
                            >
                              Khóa bài
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right: Live Activity Log Stream */}
          <aside className="proctor-activity-aside">
            <div className="activity-card-header">
              <h3>Nhật Ký Giám Sát Thời Gian Thực</h3>
              <span className="live-tag">LIVE FEED</span>
            </div>

            <div className="activity-feed-list">
              {activityLogs.map(event => (
                <div key={event.id} className={`activity-feed-item type-${event.type}`}>
                  <div className="feed-item-top">
                    <span className="feed-candidate">{event.candidateName}</span>
                    <span className="feed-time">{event.timestamp}</span>
                  </div>
                  <p className="feed-msg">{event.message}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>

        {/* Back to Home row */}
        <div className="proctor-footer-row">
          <button className="btn-room-back" onClick={onBackToHome}>
            Quay về Trang chủ
          </button>
        </div>
      </main>
    </div>
  );
};

