import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CustomExamData, Question, Answer, ViolationRecord, ParticipantResult } from '..';
import { fetchQuestions, fetchWithAuth } from '../api/apicaller';

/* ── Types ── */
interface QuestionWithAnswers {
  question: Question;
  answers: Answer[];
  rightAnswerIndex?: number;
}

interface QuestionsResponse {
  questions: QuestionWithAnswers[];
}

interface ExamPageProps {
  examId: number;
  examName: string;
  customExamData?: CustomExamData | null;
  durationMinutes?: number;
  enableAntiCheat?: boolean;
  roomParticipants?: string[];
  currentUser?: { username: string; email: string } | null;
  onBack: () => void;
}

export const ExamPage: React.FC<ExamPageProps> = ({
  examId,
  examName,
  customExamData,
  durationMinutes = 15,
  enableAntiCheat = false,
  roomParticipants,
  currentUser,
  onBack,
}) => {
  /* ── Data state ── */
  const [questionsData, setQuestionsData] = useState<QuestionWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Exam state ── */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({}); // questionId -> answerId
  const [timeLeft, setTimeLeft] = useState((durationMinutes || 15) * 60); // seconds
  const [totalDurationSeconds] = useState((durationMinutes || 15) * 60);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* ── Anti-Cheat State ── */
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(false);

  /* ── Leaderboard & Results View ── */
  const [roomLeaderboard, setRoomLeaderboard] = useState<ParticipantResult[]>([]);
  const [resultTab, setResultTab] = useState<'leaderboard' | 'review' | 'violations'>('leaderboard');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSubmitRef = useRef<(forcedDisqualified?: boolean) => void>();

  const currentUsername = currentUser?.username || 'Bạn';

  // Helper to trigger toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  /* ── Fetch or initialize questions ── */
  useEffect(() => {
    if (customExamData && customExamData.questions?.length > 0) {
      const formatted: QuestionWithAnswers[] = customExamData.questions.map((cq, idx) => ({
        question: {
          id: cq.id || idx + 1,
          exam_id: 0,
          content: cq.content,
        },
        answers: cq.answers.map((ansText, aIdx) => ({
          id: (cq.id || idx + 1) * 100 + aIdx + 1,
          question_id: cq.id || idx + 1,
          content: ansText,
        })),
        rightAnswerIndex: cq.rightAnswerIndex,
      }));
      setQuestionsData(formatted);
      setLoading(false);
      return;
    }

    if (examId > 0) {
      setLoading(true);
      fetchQuestions(examId)
        .then((data: QuestionsResponse) => {
          setQuestionsData(data.questions);
        })
        .catch(() => setError('Không thể tải câu hỏi. Vui lòng thử lại.'))
        .finally(() => setLoading(false));
    }
  }, [examId, customExamData]);

  /* ── Fullscreen Activation ── */
  const requestFullscreenMode = useCallback(() => {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {
        // Browser might block auto-fullscreen without user gesture
      });
    }
  }, []);

  const exitFullscreenMode = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Enter fullscreen on mount if anti-cheat is enabled
  useEffect(() => {
    if (enableAntiCheat && !submitted && !loading) {
      requestFullscreenMode();
    }
    return () => {
      exitFullscreenMode();
    };
  }, [enableAntiCheat, submitted, loading, requestFullscreenMode, exitFullscreenMode]);

  /* ── Anti-Cheat: Record a violation ── */
  const recordViolation = useCallback((type: ViolationRecord['type'], message: string) => {
    if (submitted) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    setViolations(prev => {
      const newRecord: ViolationRecord = {
        id: prev.length + 1,
        type,
        message,
        timestamp: timeStr,
      };
      const updated = [...prev, newRecord];

      // Show warning modal
      setWarningMessage(`${message} (Lần vi phạm: ${updated.length}/3)`);
      setShowWarningModal(true);

      // Auto-submit if 3 violations reached
      if (updated.length >= 3) {
        setIsDisqualified(true);
        setTimeout(() => {
          handleSubmitRef.current?.(true);
        }, 1200);
      }

      return updated;
    });
  }, [submitted]);

  /* ── Anti-Cheat Listeners (Visibility, Blur, Fullscreen, Keydown, ContextMenu) ── */
  useEffect(() => {
    if (!enableAntiCheat || submitted || loading || error) return;

    // 1. Tab switch / Hide
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('tab_switch', 'Rời khỏi tab thi hoặc chuyển sang ứng dụng khác');
      }
    };

    // 2. Window Blur
    const handleWindowBlur = () => {
      recordViolation('blur', 'Mất tiêu điểm cửa sổ làm bài thi');
    };

    // 3. Fullscreen Change
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && !submitted) {
        recordViolation('exit_fullscreen', 'Thoát chế độ Toàn màn hình');
      }
    };

    // 4. Keyboard Shortcuts Prevention (Ctrl+C, Ctrl+V, F12, Alt+Tab, DevTools)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
      ) {
        e.preventDefault();
        showToast('Phím tắt kiểm tra mã nguồn bị vô hiệu hóa trong phòng thi.');
        recordViolation('devtools', 'Cố gắng mở công cụ phát triển (DevTools/Inspect)');
      }

      if (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        showToast('Hành vi Sao chép / Dán bị chặn trong phòng thi.');
        recordViolation('copy_paste', 'Cố gắng sao chép hoặc dán nội dung');
      }
    };

    // 5. Right Click Prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showToast('Chuột phải bị vô hiệu hóa trong bài thi.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enableAntiCheat, submitted, loading, error, recordViolation]);

  /* ── Countdown timer ── */
  useEffect(() => {
    if (submitted || loading || error) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [submitted, loading, error]);

  /* ── Format time ── */
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  /* ── Select answer ── */
  const handleSelectAnswer = (questionId: number, answerId: number) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerId }));
  };

  /* ── Navigate questions ── */
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questionsData.length) {
      setCurrentIndex(index);
    }
  };

  /* ── Generate Room Leaderboard after exam finishes ── */
  const generateRoomLeaderboard = useCallback((myScore: number, myTotal: number, myViolations: ViolationRecord[], disqualified: boolean) => {
    const timeSpent = totalDurationSeconds - timeLeft;
    const participantsList = roomParticipants && roomParticipants.length > 0
      ? roomParticipants
      : [currentUsername, 'Nguyễn Văn A (Demo)', 'Trần Thị B (Demo)', 'Lê Hoàng C (Demo)'];

    // Current user's result
    const myResult: ParticipantResult = {
      name: currentUsername,
      isCurrentUser: true,
      isHost: true,
      score: disqualified ? 0 : myScore,
      total: myTotal,
      timeSpentSeconds: timeSpent,
      violationsCount: myViolations.length,
      violationsList: myViolations,
      status: disqualified ? 'disqualified' : timeLeft <= 0 ? 'time_out' : 'submitted',
    };

    // Generate realistic simulated results for other participants
    const otherResults: ParticipantResult[] = participantsList
      .filter(p => p !== currentUsername)
      .map((pName, idx) => {
        const simScore = Math.max(0, Math.min(myTotal, Math.round(myTotal * (0.6 + (idx * 0.15) % 0.4))));
        const simTimeSpent = Math.min(totalDurationSeconds, Math.round(timeSpent * (0.8 + idx * 0.25)));
        const simViolationsCount = idx === 1 ? 1 : idx === 2 ? 2 : 0;
        const simViolationsList: ViolationRecord[] = simViolationsCount > 0
          ? [
              {
                id: 1,
                type: 'tab_switch',
                message: 'Rời khỏi tab thi hoặc chuyển ứng dụng khác',
                timestamp: '15:20:12',
              },
            ]
          : [];

        return {
          name: pName,
          isCurrentUser: false,
          isHost: false,
          score: simScore,
          total: myTotal,
          timeSpentSeconds: simTimeSpent,
          violationsCount: simViolationsCount,
          violationsList: simViolationsList,
          status: 'submitted',
        };
      });

    const allResults = [myResult, ...otherResults];

    // Sort by: score (desc), timeSpent (asc), violations (asc)
    allResults.sort((a, b) => {
      if (a.status === 'disqualified' && b.status !== 'disqualified') return 1;
      if (b.status === 'disqualified' && a.status !== 'disqualified') return -1;
      if (b.score !== a.score) return b.score - a.score;
      if (a.timeSpentSeconds !== b.timeSpentSeconds) return a.timeSpentSeconds - b.timeSpentSeconds;
      return a.violationsCount - b.violationsCount;
    });

    setRoomLeaderboard(allResults);
  }, [totalDurationSeconds, timeLeft, roomParticipants, currentUsername]);

  /* ── Submit exam ── */
  const handleSubmit = useCallback(async (forcedDisqualified = false) => {
    if (submitted || submitting) return;
    setSubmitting(true);

    if (timerRef.current) clearInterval(timerRef.current);
    exitFullscreenMode();

    let finalScore = 0;
    const totalQ = questionsData.length || 1;

    // Calculate score
    if (customExamData && customExamData.questions?.length > 0) {
      let correctCount = 0;
      questionsData.forEach(qa => {
        const selectedAnswerId = selectedAnswers[qa.question.id];
        if (selectedAnswerId !== undefined && qa.rightAnswerIndex !== undefined) {
          const selectedIdx = qa.answers.findIndex(a => a.id === selectedAnswerId);
          if (selectedIdx === qa.rightAnswerIndex) {
            correctCount++;
          }
        }
      });
      finalScore = correctCount;
    } else {
      const payload = {
        exam_id: examId,
        questions: questionsData.map(qa => {
          const answerContents = qa.answers.map(a => a.content);
          const selectedAnswerId = selectedAnswers[qa.question.id];
          const selectedIdx = selectedAnswerId
            ? qa.answers.findIndex(a => a.id === selectedAnswerId)
            : 0;

          return {
            question: qa.question.content,
            answers: answerContents,
            right_answer: selectedIdx >= 0 ? selectedIdx : 0,
          };
        }),
      };

      try {
        const res = await fetchWithAuth('/api/score', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const result = await res.json();
          finalScore = result.score;
        }
      } catch {
        finalScore = 0;
      }
    }

    setSubmitted(true);
    setSubmitting(false);

    // Generate Room Leaderboard with violation summaries
    generateRoomLeaderboard(finalScore, totalQ, violations, forcedDisqualified || isDisqualified);
  }, [
    submitted,
    submitting,
    questionsData,
    selectedAnswers,
    examId,
    customExamData,
    violations,
    isDisqualified,
    generateRoomLeaderboard,
    exitFullscreenMode,
  ]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div className="exam-page">
        <div className="exam-loading">
          <div className="exam-loading-spinner"></div>
          <p>Đang tải câu hỏi bài thi...</p>
        </div>
      </div>
    );
  }

  if (error || questionsData.length === 0) {
    return (
      <div className="exam-page">
        <div className="exam-error">
          <p>{error || 'Không có câu hỏi nào cho đề thi này.'}</p>
          <button className="btn-primary" onClick={onBack}>Quay lại</button>
        </div>
      </div>
    );
  }

  const currentQ = questionsData[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isTimeLow = timeLeft <= 60;

  return (
    <div className={`exam-page ${enableAntiCheat ? 'anti-cheat-mode' : ''}`}>
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="exam-toast">
          {toastMessage}
        </div>
      )}

      {/* ── Anti-Cheat Urgent Warning Modal ── */}
      {showWarningModal && (
        <div className="violation-modal-overlay">
          <div className="violation-modal-card">
            <h3>CẢNH BÁO GIÁM SÁT THI</h3>
            <p className="violation-desc">{warningMessage}</p>
            <div className="violation-count-badge">
              Số lần vi phạm: <strong>{violations.length} / 3</strong>
            </div>
            <p className="violation-subtext">
              {violations.length >= 3
                ? 'Bạn đã vi phạm 3 lần! Bài thi sẽ tự động khóa và nộp điểm...'
                : 'Mọi hành vi chuyển tab, thoát toàn màn hình đều được ghi nhận vào bảng điểm tổng hợp.'}
            </p>
            {violations.length < 3 && (
              <button
                className="btn-continue-exam"
                onClick={() => {
                  setShowWarningModal(false);
                  requestFullscreenMode();
                }}
              >
                Tôi đã hiểu & Tiếp tục làm bài
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Top Header Bar ── */}
      <div className="exam-header-bar">
        <button className="exam-back-btn" onClick={onBack}>
          ← Thoát
        </button>

        <div className="exam-title-center">
          <h2 className="exam-title-bar">{examName}</h2>
          {enableAntiCheat && (
            <span className="proctoring-indicator">
              Giám sát chống gian lận ({violations.length}/3 vi phạm)
            </span>
          )}
        </div>

        <div className="exam-header-right">
          {enableAntiCheat && !isFullscreen && !submitted && (
            <button className="btn-fullscreen-toggle" onClick={requestFullscreenMode}>
              Toàn màn hình
            </button>
          )}
          <div className={`exam-timer ${isTimeLow ? 'timer-warning' : ''}`}>
            <span className="timer-value">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="exam-content">
        {/* ── Left: Question area OR Room Leaderboard ── */}
        <div className="exam-question-area">
          {!submitted ? (
            <>
              {/* Question header */}
              <div className="question-header">
                <span className="question-number">Câu {currentIndex + 1}/{questionsData.length}</span>
                {enableAntiCheat && violations.length > 0 && (
                  <span className="violation-pill-warning">
                    {violations.length} lần vi phạm
                  </span>
                )}
              </div>

              {/* Question content */}
              <div className="question-content">
                <p>{currentQ.question.content}</p>
              </div>

              {/* Answer options */}
              <div className="answer-options">
                {currentQ.answers.map((answer, idx) => {
                  const isSelected = selectedAnswers[currentQ.question.id] === answer.id;
                  const labels = ['A', 'B', 'C', 'D'];
                  return (
                    <button
                      key={answer.id}
                      className={`answer-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectAnswer(currentQ.question.id, answer.id)}
                    >
                      <span className="answer-label">{labels[idx] || String.fromCharCode(65 + idx)}</span>
                      <span className="answer-text">{answer.content}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation buttons */}
              <div className="question-nav">
                <button
                  className="btn-nav"
                  disabled={currentIndex === 0}
                  onClick={() => goToQuestion(currentIndex - 1)}
                >
                  ← Câu trước
                </button>
                <button
                  className="btn-nav btn-nav-next"
                  disabled={currentIndex === questionsData.length - 1}
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  Câu tiếp →
                </button>
              </div>
            </>
          ) : (
            /* ================================================================
               RESULT SCREEN WITH ROOM LEADERBOARD & VIOLATION SUMMARY
               ================================================================ */
            <div className="exam-result-room">
              <div className="result-hero-banner">
                <h2>{isDisqualified ? 'Bài thi đã bị khóa do vi phạm' : 'Tổng Kết Kết Quả Phòng Thi'}</h2>
                <p className="result-exam-name">{examName}</p>
              </div>

              {/* Result Tabs */}
              <div className="result-view-tabs">
                <button
                  className={`result-tab-btn ${resultTab === 'leaderboard' ? 'active' : ''}`}
                  onClick={() => setResultTab('leaderboard')}
                >
                  Bảng Xếp Hạng Toàn Phòng ({roomLeaderboard.length})
                </button>
                <button
                  className={`result-tab-btn ${resultTab === 'violations' ? 'active' : ''}`}
                  onClick={() => setResultTab('violations')}
                >
                  Nhật Ký Giám Sát ({violations.length})
                </button>
              </div>

              {/* TAB 1: ROOM LEADERBOARD TABLE */}
              {resultTab === 'leaderboard' && (
                <div className="leaderboard-table-container">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>Hạng</th>
                        <th>Thí sinh</th>
                        <th>Điểm số</th>
                        <th>Thời gian</th>
                        <th>Giám sát Vi phạm</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomLeaderboard.map((player, idx) => {
                        const rankDisplay = `#${idx + 1}`;
                        const percentage = Math.round((player.score / player.total) * 100);

                        return (
                          <tr
                            key={idx}
                            className={`leaderboard-row ${player.isCurrentUser ? 'current-user-row' : ''} ${player.status === 'disqualified' ? 'disqualified-row' : ''}`}
                          >
                            <td className="rank-cell">
                              <span className="rank-badge">{rankDisplay}</span>
                            </td>
                            <td className="player-cell">
                              <div className="player-info">
                                <div className="player-avatar">
                                  {player.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="player-name-wrapper">
                                  <strong>{player.name}</strong>
                                  {player.isCurrentUser && <span className="tag-you">Bạn</span>}
                                  {player.isHost && <span className="tag-host">Chủ phòng</span>}
                                </div>
                              </div>
                            </td>
                            <td className="score-cell">
                              <div className="score-badge-wrap">
                                <span className="score-text">{player.score}/{player.total}</span>
                                <span className="score-percent">({percentage}%)</span>
                              </div>
                            </td>
                            <td className="time-cell">
                              {Math.floor(player.timeSpentSeconds / 60)}p {player.timeSpentSeconds % 60}s
                            </td>
                            <td className="violation-cell">
                              {player.violationsCount === 0 ? (
                                <span className="badge-clean">
                                  Trong sạch (0 vi phạm)
                                </span>
                              ) : player.violationsCount < 3 ? (
                                <span className="badge-violation-warn">
                                  {player.violationsCount} lần vi phạm
                                </span>
                              ) : (
                                <span className="badge-violation-danger">
                                  {player.violationsCount} vi phạm (Khóa bài)
                                </span>
                              )}
                            </td>
                            <td className="status-cell">
                              {player.status === 'disqualified' ? (
                                <span className="status-tag danger">Bị truất quyền</span>
                              ) : player.status === 'time_out' ? (
                                <span className="status-tag warn">Hết giờ nộp</span>
                              ) : (
                                <span className="status-tag success">Đã nộp bài</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: VIOLATION LOGS */}
              {resultTab === 'violations' && (
                <div className="violations-log-container">
                  {violations.length > 0 ? (
                    <div className="violations-list">
                      {violations.map((v, i) => (
                        <div key={i} className="violation-log-item">
                          <div className="v-log-content">
                            <h4>Vi phạm lần #{i + 1}: {v.message}</h4>
                            <span className="v-log-time">Thời điểm: {v.timestamp}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="clean-proctor-card">
                      <h3>Không ghi nhận hành vi vi phạm nào</h3>
                      <p>Bạn đã hoàn thành bài thi với tính trung thực trong suốt thời gian làm bài.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="result-actions-row">
                <button className="btn-primary result-back-btn" onClick={onBack}>
                  ← Quay về Phòng thi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Question navigator panel ── */}
        {!submitted && (
          <div className="exam-sidebar">
            <div className="sidebar-panel">
              <h3 className="panel-title">Danh sách câu hỏi</h3>
              <p className="panel-progress">
                Đã trả lời: <strong>{answeredCount}</strong> / {questionsData.length}
              </p>

              <div className="question-grid">
                {questionsData.map((qa, idx) => {
                  const isAnswered = selectedAnswers[qa.question.id] !== undefined;
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={qa.question.id}
                      className={`q-grid-btn ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''}`}
                      onClick={() => goToQuestion(idx)}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="q-legend">
                <div className="legend-item">
                  <span className="legend-dot current"></span> Đang xem
                </div>
                <div className="legend-item">
                  <span className="legend-dot answered"></span> Đã trả lời
                </div>
                <div className="legend-item">
                  <span className="legend-dot"></span> Chưa trả lời
                </div>
              </div>

              {/* Submit button */}
              <button
                className="btn-submit-exam"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
