import React, { useState, useEffect, useRef } from 'react';
import { CandidateProgress, ProctorActivityEvent, CustomExamData, CandidateLiveState } from '..';

interface ProctorDashboardProps {
  roomCode: string;
  roomTitle: string;
  examName: string;
  customExamData?: CustomExamData | null;
  durationMinutes: number;
  enableAntiCheat: boolean;
  participants: string[];
  currentUser: { username: string; email: string } | null;
  onEndExam: () => void;
  onBackToHome: () => void;
}

export const ProctorDashboard: React.FC<ProctorDashboardProps> = ({
  roomCode,
  roomTitle,
  examName,
  customExamData,
  durationMinutes = 15,
  enableAntiCheat = true,
  participants,
  currentUser,
  onEndExam,
  onBackToHome,
}) => {
  const totalDurationSeconds = durationMinutes * 60;
  const [timeLeft, setTimeLeft] = useState<number>(totalDurationSeconds);
  const [isExamFinished, setIsExamFinished] = useState<boolean>(false);
  const totalQuestions = customExamData?.questions?.length || 10;

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

  /* ── Room Countdown Timer ── */
  useEffect(() => {
    if (isExamFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsExamFinished(true);
          addActivityLog('Hệ thống', 'info', 'Thời gian làm bài của phòng thi đã kết thúc. Toàn bộ bài làm đã được thu tự động.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamFinished]);

  /* ── Realistic Live Simulation of Student Actions & Heartbeat Events ── */
  useEffect(() => {
    if (isExamFinished) return;

    const interval = setInterval(() => {
      setCandidates(prev => {
        return prev.map(cand => {
          if (cand.state === 'submitted' || cand.state === 'disqualified') {
            return cand;
          }

          // Random candidate answer progress progression
          let newAnswered = cand.answeredCount;
          if (Math.random() < 0.35 && newAnswered < totalQuestions) {
            newAnswered += 1;
          }

          // Random simulated network disruption or tab switch
          const rand = Math.random();
          let newState: CandidateLiveState = cand.state;
          let newViolations = [...cand.violationsList];

          // 1. Simulate Network Disconnect / Offline (Rare ~ 3% chance)
          if (cand.state === 'active' && rand < 0.03) {
            newState = 'offline';
            addActivityLog(cand.name, 'warning', `Mất tín hiệu kết nối Internet (Offline). Bài làm tạm thời được lưu an toàn trên máy thí sinh.`);
          }
          // Reconnect back from offline (~ 40% chance when offline)
          else if (cand.state === 'offline' && rand < 0.40) {
            newState = 'active';
            addActivityLog(cand.name, 'success', `Đã kết nối lại thành công sau sự cố gián đoạn.`);
          }
          // 2. Simulate Tab Switch Violation (~ 4% chance if anti-cheat enabled)
          else if (enableAntiCheat && cand.state === 'active' && rand > 0.96) {
            const vRecord = {
              id: newViolations.length + 1,
              type: 'tab_switch' as const,
              message: 'Rời khỏi tab bài thi hoặc chuyển sang ứng dụng khác',
              timestamp: new Date().toLocaleTimeString(),
            };
            newViolations.push(vRecord);
            addActivityLog(cand.name, 'danger', `Vi phạm lần #${newViolations.length}: Rời tab bài thi sang ứng dụng khác.`);

            if (newViolations.length >= 3) {
              newState = 'disqualified';
              addActivityLog(cand.name, 'danger', `ĐÃ BỊ TRUẤT QUYỀN: Vi phạm quy chế quá 3 lần.`);
            }
          }
          // 3. Complete and submit exam when all questions answered
          else if (newAnswered >= totalQuestions && cand.state === 'active' && rand < 0.2) {
            newState = 'submitted';
            const simScore = Math.max(1, Math.round(totalQuestions * (0.6 + (Math.random() * 0.4))));
            cand.score = simScore;
            addActivityLog(cand.name, 'info', `Đã nộp bài thi thành công. Điểm số: ${simScore}/${totalQuestions}.`);
          }

          return {
            ...cand,
            state: newState,
            answeredCount: newAnswered,
            violationsCount: newViolations.length,
            violationsList: newViolations,
            timeSpentSeconds: cand.timeSpentSeconds + 2,
            lastHeartbeat: newState === 'offline' ? 'Mất tín hiệu' : '1s trước',
          };
        });
      });
    }, 2500);

    return () => clearInterval(interval);
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
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn kết thúc buổi thi và thu bài của tất cả thí sinh ngay bây giờ?')) {
                setIsExamFinished(true);
                onEndExam();
              }
            }}
          >
            Kết thúc phòng thi
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
                    const percent = Math.round((cand.answeredCount / cand.totalQuestions) * 100);

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
