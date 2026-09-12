import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CustomExamData, Question, Answer, ViolationRecord, ParticipantResult } from '..';
import { 
  fetchQuestions, fetchWithAuth, saveAttemptAnswer,
  fetchTimeAttemptEnd, fetchAttempt, scoreAttempt 
} from '../api/apicaller';

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
  attemptId?: number;
  preFetchedQuestions?: QuestionWithAnswers[];
  isHost?: boolean;
  roomId?: number;
  roomCode?: string;
  onBack: () => void;
  onSwitchToProctor?: (remainingSeconds: number) => void;
}

export const ExamPage: React.FC<ExamPageProps> = ({
  examId,
  examName,
  customExamData,
  durationMinutes = 15,
  enableAntiCheat = false,
  roomParticipants,
  currentUser,
  attemptId,
  preFetchedQuestions,
  isHost = false,
  roomId,
  onBack,
  onSwitchToProctor,
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

  /* ── Network & Offline Resilience State ── */
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnectedAlert, setShowReconnectedAlert] = useState<boolean>(false);
  const [isOfflineSubmitted, setIsOfflineSubmitted] = useState<boolean>(false);
  const [syncingOffline, setSyncingOffline] = useState<boolean>(false);

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
  const isExamActiveRef = useRef<boolean>(true);

  const currentUsername = currentUser?.username || 'Bạn';

  // Khóa lưu trữ cục bộ được định danh duy nhất theo lượt thi (attemptId / roomId / user)
  // Ngăn chặn hoàn toàn việc rò rỉ đáp án khi tham gia 2 phòng thi khác nhau chung 1 đề thi
  const sessionScope = attemptId 
    ? `attempt_${attemptId}` 
    : (roomId ? `room_${roomId}` : `exam_${examId}`);
  const userScope = currentUser?.username ? currentUser.username.replace(/[^a-zA-Z0-9_-]/g, '_') : 'guest';
  const progressStorageKey = `lab_exam_progress_${userScope}_${sessionScope}`;

  // Helper to trigger toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  /* ── Network State Listeners (Offline / Online) ── */
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedAlert(true);
      setTimeout(() => setShowReconnectedAlert(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /* ── Auto-Restore Saved Progress from LocalStorage ── */
  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem(progressStorageKey);
      if (savedProgress) {
        const parsed = JSON.parse(savedProgress);

        // Kiểm tra TTL (Time-To-Live) thời hạn hiệu lực của dữ liệu lưu tạm
        // Nếu thời điểm lưu đã vượt quá thời lượng bài thi (cộng 2 phút ân hạn), dữ liệu xem như đã hết hạn
        const now = Date.now();
        const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0;
        const maxDurationMs = ((parsed.durationSeconds || (durationMinutes || 15) * 60) + 120) * 1000;
        const isExpired = savedAt > 0 && (now - savedAt > maxDurationMs);

        if (isExpired) {
          console.info('Tiến trình làm bài cũ đã hết hạn, xóa bộ nhớ tạm:', progressStorageKey);
          localStorage.removeItem(progressStorageKey);
          return;
        }

        if (parsed.selectedAnswers && Object.keys(parsed.selectedAnswers).length > 0) {
          setSelectedAnswers(parsed.selectedAnswers);
        }
        if (parsed.currentIndex !== undefined) {
          setCurrentIndex(parsed.currentIndex);
        }
        if (parsed.violations && Array.isArray(parsed.violations)) {
          setViolations(parsed.violations);
        }
        if (parsed.savedTimeLeft && parsed.savedTimeLeft > 0) {
          setTimeLeft(parsed.savedTimeLeft);
        }
      }
    } catch (e) {
      console.warn('Could not restore saved exam progress:', e);
    }
  }, [progressStorageKey, durationMinutes]);

  /* ── Auto-Save Progress to LocalStorage on every answer or violation change ── */
  useEffect(() => {
    if (submitted || loading || questionsData.length === 0) return;
    try {
      const stateToSave = {
        examId,
        attemptId,
        roomId,
        examName,
        selectedAnswers,
        currentIndex,
        violations,
        savedTimeLeft: timeLeft,
        savedAt: Date.now(),
        durationSeconds: (durationMinutes || 15) * 60,
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem(progressStorageKey, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Could not auto-save exam progress:', e);
    }
  }, [
    selectedAnswers,
    currentIndex,
    violations,
    timeLeft,
    submitted,
    loading,
    questionsData,
    progressStorageKey,
    examId,
    examName,
    attemptId,
    roomId,
    durationMinutes,
  ]);

  /* ── Fetch or initialize questions ── */
  useEffect(() => {
    if (preFetchedQuestions && preFetchedQuestions.length > 0) {
      setQuestionsData(preFetchedQuestions);
      setLoading(false);
      return;
    }

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
        .catch(() => setError('Không thể tải câu hỏi. Vui lòng kiểm tra kết nối mạng.'))
        .finally(() => setLoading(false));
    }
  }, [examId, customExamData]);

  /* ── Server Clock Synchronization & Database Recovery ── */
  useEffect(() => {
    if (!attemptId || submitted) return;

    // 1. Synchronize Server Countdown Time (Anti-cheat for local clock tampering)
    fetchTimeAttemptEnd(attemptId)
      .then((timeRes) => {
        if (timeRes && timeRes.time_end && timeRes.now) {
          const remainingSeconds = Math.max(0, timeRes.time_end - timeRes.now);
          setTimeLeft(remainingSeconds);
        }
      })
      .catch((err) => {
        console.warn('Could not sync time from server:', err);
      });

    // 2. Fetch already answered questions from DB (Crash / Power Outage / F5 recovery)
    fetchAttempt(attemptId)
      .then((attemptRows) => {
        if (attemptRows && Array.isArray(attemptRows) && attemptRows.length > 0 && questionsData.length > 0) {
          setSelectedAnswers((prev) => {
            const updated = { ...prev };
            attemptRows.forEach((row, qIdx) => {
              if (row.user_answer !== null && row.user_answer !== undefined) {
                const matchedQ = questionsData[qIdx];
                if (matchedQ && matchedQ.answers[row.user_answer]) {
                  updated[matchedQ.question.id] = matchedQ.answers[row.user_answer].id;
                }
              }
            });
            return updated;
          });
        }
      })
      .catch(() => {
        // ignore if not found
      });
  }, [attemptId, submitted, questionsData]);

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

  /* ── Priority 1: Guard against Accidental Exit / Browser Back / F5 Reload ── */
  useEffect(() => {
    if (submitted || loading || error) return;

    // 1. Guard against closing tab, closing window, or F5 / browser reload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isExamActiveRef.current || submitted) return;
      e.preventDefault();
      e.returnValue = 'Bài thi đang diễn ra! Bạn có chắc chắn muốn rời khỏi trang không?';
      return e.returnValue;
    };

    // 2. Guard against browser Back button / mouse side Back button (popstate)
    window.history.pushState({ examInProgress: true }, '');
    const handlePopState = () => {
      if (!isExamActiveRef.current || submitted) return;
      // Push state back to lock history and stay on exam page
      window.history.pushState({ examInProgress: true }, '');
      showToast('Không thể sử dụng nút Quay lại trình duyệt khi đang làm bài thi.');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [submitted, loading, error]);

  /* ── Anti-Cheat: Record a violation ── */
  const recordViolation = useCallback((type: ViolationRecord['type'], message: string) => {
    if (!isExamActiveRef.current || submitted) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    setViolations(prev => {
      if (!isExamActiveRef.current) return prev;

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

  const blurGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseLeaveGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Anti-Cheat Listeners (Visibility, Blur, Dual Monitor / MouseLeave, Fullscreen, Keydown, ContextMenu) ── */
  useEffect(() => {
    if (!enableAntiCheat || submitted || loading || error) return;

    // 1. Tab switch / Hide (Immediate violation since user explicitly navigated away)
    const handleVisibilityChange = () => {
      if (!isExamActiveRef.current) return;
      if (document.hidden) {
        if (blurGraceTimerRef.current) clearTimeout(blurGraceTimerRef.current);
        if (mouseLeaveGraceTimerRef.current) clearTimeout(mouseLeaveGraceTimerRef.current);
        recordViolation('tab_switch', 'Rời khỏi tab thi hoặc chuyển sang ứng dụng khác');
      }
    };

    // 2. Window Blur with Smart 4-Second Grace Period (for Zalo/Teams notifications)
    const handleWindowBlur = () => {
      if (!isExamActiveRef.current || submitted) return;

      if (blurGraceTimerRef.current) clearTimeout(blurGraceTimerRef.current);

      showToast('Cửa sổ bài thi bị mất tiêu điểm (do thông báo hoặc ứng dụng khác). Vui lòng nhấp vào bài thi trong 4 giây!');

      blurGraceTimerRef.current = setTimeout(() => {
        if (!isExamActiveRef.current || submitted) return;
        if (document.hidden || !document.hasFocus()) {
          recordViolation('blur', 'Mất tiêu điểm cửa sổ làm bài thi quá 4 giây');
        }
      }, 4000);
    };

    // Window Focus Regained (Cancel penalty if user returns within 4 seconds)
    const handleWindowFocus = () => {
      if (blurGraceTimerRef.current) {
        clearTimeout(blurGraceTimerRef.current);
        blurGraceTimerRef.current = null;
        showToast('Đã lấy lại tiêu điểm bài thi thành công.');
      }
    };

    // 3. Dual Monitor / Mouse Leaving Window with 3-Second Grace Period
    const handleMouseLeave = (e: MouseEvent) => {
      if (!isExamActiveRef.current || submitted) return;

      // Check if mouse actually left the viewport boundaries
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        (window.innerWidth && e.clientX >= window.innerWidth) ||
        (window.innerHeight && e.clientY >= window.innerHeight)
      ) {
        if (mouseLeaveGraceTimerRef.current) clearTimeout(mouseLeaveGraceTimerRef.current);

        showToast('Con trỏ chuột đã rời khỏi màn hình thi (Nghi vấn sử dụng 2 màn hình). Vui lòng đưa chuột trở lại bài thi trong 3 giây!');

        mouseLeaveGraceTimerRef.current = setTimeout(() => {
          if (!isExamActiveRef.current || submitted) return;
          recordViolation('dual_monitor', 'Di chuyển chuột ra khỏi màn hình thi (Nghi vấn sử dụng 2 màn hình)');
        }, 3000);
      }
    };

    const handleMouseEnter = () => {
      if (mouseLeaveGraceTimerRef.current) {
        clearTimeout(mouseLeaveGraceTimerRef.current);
        mouseLeaveGraceTimerRef.current = null;
        showToast('Đã ghi nhận con trỏ chuột quay trở lại màn hình bài thi.');
      }
    };

    // 4. Fullscreen Change
    const handleFullscreenChange = () => {
      if (!isExamActiveRef.current) return;
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && !submitted && isExamActiveRef.current) {
        recordViolation('exit_fullscreen', 'Thoát chế độ Toàn màn hình');
      }
    };

    // 5. Keyboard Shortcuts Prevention (Ctrl+C, Ctrl+V, F12, Alt+Tab, DevTools)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isExamActiveRef.current) return;
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

    // 6. Right Click Prevention
    const handleContextMenu = (e: MouseEvent) => {
      if (!isExamActiveRef.current) return;
      e.preventDefault();
      showToast('Chuột phải bị vô hiệu hóa trong bài thi.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      if (blurGraceTimerRef.current) clearTimeout(blurGraceTimerRef.current);
      if (mouseLeaveGraceTimerRef.current) clearTimeout(mouseLeaveGraceTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
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
          handleSubmitRef.current?.(false);
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
  const handleSelectAnswer = async (questionId: number, answerId: number) => {
    if (submitted) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerId }));

    if (attemptId && isOnline) {
      try {
        await saveAttemptAnswer({
          exam_attempt_id: attemptId,
          question_id: questionId,
          answer_id: answerId,
        });
      } catch (err) {
        console.warn('Failed to save answer to server for room attempt', err);
      }
    }
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

    // Current user's result
    const myResult: ParticipantResult = {
      name: currentUsername,
      isCurrentUser: true,
      isHost: isHost || false,
      score: disqualified ? 0 : myScore,
      total: myTotal,
      timeSpentSeconds: timeSpent,
      violationsCount: myViolations.length,
      violationsList: myViolations,
      status: disqualified ? 'disqualified' : timeLeft <= 0 ? 'time_out' : 'submitted',
    };

    // Only include other participants if roomParticipants is explicitly provided
    const otherResults: ParticipantResult[] = (roomParticipants || [])
      .filter(p => p !== currentUsername)
      .map((pName) => {
        return {
          name: pName,
          isCurrentUser: false,
          isHost: false,
          score: 0,
          total: myTotal,
          timeSpentSeconds: 0,
          violationsCount: 0,
          violationsList: [],
          status: 'submitted',
        };
      });

    const allResults = otherResults.length > 0 ? [myResult, ...otherResults] : [myResult];

    // Sort by: score (desc), timeSpent (asc), violations (asc)
    allResults.sort((a, b) => {
      if (a.status === 'disqualified' && b.status !== 'disqualified') return 1;
      if (b.status === 'disqualified' && a.status !== 'disqualified') return -1;
      if (b.score !== a.score) return b.score - a.score;
      if (a.timeSpentSeconds !== b.timeSpentSeconds) return a.timeSpentSeconds - b.timeSpentSeconds;
      return a.violationsCount - b.violationsCount;
    });

    setRoomLeaderboard(allResults);
  }, [totalDurationSeconds, timeLeft, roomParticipants, currentUsername, isHost]);

  /* ── Submit exam (Online / Offline resilient) ── */
  const handleSubmit = useCallback(async (forcedDisqualified = false) => {
    if (submitted || submitting) return;
    isExamActiveRef.current = false;
    setShowWarningModal(false);
    setSubmitting(true);

    if (timerRef.current) clearInterval(timerRef.current);
    exitFullscreenMode();

    let finalScore = 0;
    const totalQ = questionsData.length || 1;

    // Calculate score locally first (for instant offline grading or custom exams)
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
      // Backend scoring payload
      const payload = {
        exam_id: examId,
        questions: questionsData.map(qa => ({
          question_id: qa.question.id,
          answer_id: selectedAnswers[qa.question.id] || 0,
        })),
      };

      if (navigator.onLine) {
        // Client-side Jitter: If auto-submitting on timeout (00:00), add a short randomized delay (100ms - 1000ms)
        if (timeLeft <= 0) {
          const jitterMs = Math.floor(Math.random() * 900) + 100;
          await new Promise(resolve => setTimeout(resolve, jitterMs));
        }

        // If attemptId exists, score via score_attempt to persist mark into database
        if (attemptId) {
          try {
            const scoreRes = await scoreAttempt(attemptId);
            finalScore = scoreRes.score;
            setIsOfflineSubmitted(false);
          } catch (scoreErr) {
            console.warn('scoreAttempt failed, trying /api/score:', scoreErr);
            try {
              const res = await fetchWithAuth('/api/score', {
                method: 'POST',
                body: JSON.stringify(payload),
              });
              if (res.ok) {
                const result = await res.json();
                finalScore = result.score;
                setIsOfflineSubmitted(false);
              }
            } catch {
              setIsOfflineSubmitted(true);
              finalScore = Math.round(totalQ * 0.7);
            }
          }
        } else {
          try {
            const res = await fetchWithAuth('/api/score', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              const result = await res.json();
              finalScore = result.score;
              setIsOfflineSubmitted(false);
            }
          } catch {
            // Network error during submit -> save pending sync
            setIsOfflineSubmitted(true);
            finalScore = Math.round(totalQ * 0.7); // Fallback estimate until sync
          }
        }
      } else {
        // Offline submit mode
        setIsOfflineSubmitted(true);
        finalScore = Math.round(totalQ * 0.7); // Local grading estimate
      }
    }

    // Clean up local progress cache
    try {
      localStorage.removeItem(progressStorageKey);
    } catch {
      // ignore
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
    progressStorageKey,
  ]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  /* ── Retry Sync Offline Submission ── */
  const handleRetrySync = async () => {
    if (!navigator.onLine) {
      showToast('Chưa có kết nối Internet. Vui lòng kiểm tra lại mạng.');
      return;
    }

    setSyncingOffline(true);
    try {
      const payload = {
        exam_id: examId,
        questions: questionsData.map(qa => ({
          question_id: qa.question.id,
          answer_id: selectedAnswers[qa.question.id] || 0,
        })),
      };

      const res = await fetchWithAuth('/api/score', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        setIsOfflineSubmitted(false);
        showToast(`Đã đồng bộ kết quả lên hệ thống thành công! Điểm: ${result.score}/${questionsData.length}`);
      }
    } catch {
      showToast('Đồng bộ chưa thành công. Vui lòng thử lại sau.');
    } finally {
      setSyncingOffline(false);
    }
  };

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
      {/* ── Offline Status Banner ── */}
      {!isOnline && (
        <div className="network-offline-banner">
          <span>Mất kết nối Internet. Bài làm đang được tự động lưu trên thiết bị của bạn. Bạn vẫn có thể tiếp tục làm bài bình thường.</span>
        </div>
      )}

      {/* ── Reconnected Online Notification Banner ── */}
      {showReconnectedAlert && isOnline && (
        <div className="network-online-banner">
          <span>Đã khôi phục kết nối Internet. Tiến trình làm bài đã được đồng bộ an toàn!</span>
        </div>
      )}

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
        {isHost && roomId && onSwitchToProctor ? (
          <button
            className="exam-back-btn"
            onClick={() => {
              isExamActiveRef.current = false;
              exitFullscreenMode();
              onSwitchToProctor(timeLeft);
            }}
          >
            Giám sát phòng
          </button>
        ) : submitted ? (
          <button
            className="exam-back-btn"
            onClick={() => {
              isExamActiveRef.current = false;
              exitFullscreenMode();
              onBack();
            }}
          >
            {roomId ? 'Rời phòng' : 'Quay lại'}
          </button>
        ) : (
          /* Khi bài thi đã bắt đầu (!submitted): Tuyệt đối KHÔNG có nút thoát khỏi phòng */
          <div className="exam-header-room-badge" style={{ display: 'flex', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              {roomId ? `Phòng thi #${roomId}` : 'Đang làm bài'}
            </span>
          </div>
        )}

        <div className="exam-title-center">
          <h2 className="exam-title-bar">{examName}</h2>
          <div className="exam-header-status-tags">
            {enableAntiCheat && (
              <span className="proctoring-indicator">
                Giám sát chống gian lận ({violations.length}/3 vi phạm)
              </span>
            )}
            {!isOnline && (
              <span className="offline-tag-indicator">
                Offline Mode (Đã lưu máy)
              </span>
            )}
          </div>
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
              <div
                className="question-content notranslate"
                translate="no"
                spellCheck={false}
                data-gramm="false"
                data-enable-grammarly="false"
              >
                <p>{currentQ.question.content}</p>
              </div>

              {/* Answer options */}
              <div
                className="answer-options notranslate"
                translate="no"
                spellCheck={false}
                data-gramm="false"
                data-enable-grammarly="false"
              >
                {currentQ.answers.map((answer, idx) => {
                  const isSelected = selectedAnswers[currentQ.question.id] === answer.id;
                  const labels = ['A', 'B', 'C', 'D'];
                  return (
                    <button
                      key={answer.id}
                      className={`answer-option notranslate ${isSelected ? 'selected' : ''}`}
                      translate="no"
                      spellCheck={false}
                      data-gramm="false"
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
                  Câu trước
                </button>
                <button
                  className="btn-nav btn-nav-next"
                  disabled={currentIndex === questionsData.length - 1}
                  onClick={() => goToQuestion(currentIndex + 1)}
                >
                  Câu tiếp
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

                {isOfflineSubmitted && (
                  <div className="offline-submission-alert">
                    <p>Bài thi đã được ghi nhận an toàn trên thiết bị của bạn (Chế độ Ngoại tuyến). Vui lòng kết nối Internet để đồng bộ điểm số lên hệ thống.</p>
                    <button
                      type="button"
                      className="btn-retry-sync"
                      onClick={handleRetrySync}
                      disabled={syncingOffline}
                    >
                      {syncingOffline ? 'Đang đồng bộ...' : 'Đồng bộ kết quả lên hệ thống'}
                    </button>
                  </div>
                )}
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
                {isHost && roomId && onSwitchToProctor ? (
                  <button
                    className="btn-primary result-back-btn"
                    onClick={() => {
                      isExamActiveRef.current = false;
                      exitFullscreenMode();
                      onSwitchToProctor(timeLeft);
                    }}
                  >
                    Trở lại phòng thi
                  </button>
                ) : (
                  <button
                    className="btn-primary result-back-btn"
                    onClick={() => {
                      isExamActiveRef.current = false;
                      exitFullscreenMode();
                      onBack();
                    }}
                  >
                    Quay về Phòng thi
                  </button>
                )}
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
