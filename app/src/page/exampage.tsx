import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Question, Answer } from '..';
import { fetchQuestions } from '../api/apicaller';

/* ── Types ── */
interface QuestionWithAnswers {
  question: Question;
  answers: Answer[];
}

interface QuestionsResponse {
  questions: QuestionWithAnswers[];
}

interface ExamPageProps {
  examId: number;
  examName: string;
  onBack: () => void;
}

/* Duration mỗi bài thi (phút) */
const EXAM_DURATION_MINUTES = 15;

export const ExamPage: React.FC<ExamPageProps> = ({ examId, examName, onBack }) => {
  /* ── Data state ── */
  const [questionsData, setQuestionsData] = useState<QuestionWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Exam state ── */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({}); // questionId -> answerId
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_MINUTES * 60); // seconds
  const [submitted, setSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch questions ── */
  useEffect(() => {
    setLoading(true);
    fetchQuestions(examId)
      .then((data: QuestionsResponse) => {
        setQuestionsData(data.questions);
      })
      .catch(() => setError('Không thể tải câu hỏi. Vui lòng thử lại.'))
      .finally(() => setLoading(false));
  }, [examId]);

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

  /* ── Submit exam ── */
  const handleSubmit = useCallback(async () => {
    if (submitted || submitting) return;
    setSubmitting(true);

    // Stop the timer
    if (timerRef.current) clearInterval(timerRef.current);

    // Build payload matching DoScoreRequest
    const payload = {
      exam_id: examId,
      questions: questionsData.map(qa => {
        const answerContents = qa.answers.map(a => a.content);
        const selectedAnswerId = selectedAnswers[qa.question.id];
        const selectedIdx = selectedAnswerId
          ? qa.answers.findIndex(a => a.id === selectedAnswerId)
          : 0; // default to first if not answered

        return {
          question: qa.question.content,
          answers: answerContents,
          right_answer: selectedIdx >= 0 ? selectedIdx : 0,
        };
      }),
    };

    // Attempt to submit to backend
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Submit failed');

      const result = await res.json();
      setScoreResult({ score: result.score, total: result.sum_of_question });
      setSubmitted(true);
    } catch {
      // Fallback: calculate locally
      setScoreResult(null);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [submitted, submitting, questionsData, selectedAnswers, examId]);

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div className="exam-page">
        <div className="exam-loading">
          <div className="exam-loading-spinner"></div>
          <p>Đang tải câu hỏi...</p>
        </div>
      </div>
    );
  }

  if (error || questionsData.length === 0) {
    return (
      <div className="exam-page">
        <div className="exam-error">
          <p>❌ {error || 'Không có câu hỏi nào cho đề thi này.'}</p>
          <button className="btn-primary" onClick={onBack}>Quay lại</button>
        </div>
      </div>
    );
  }

  const currentQ = questionsData[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).length;
  const isTimeLow = timeLeft <= 60;

  return (
    <div className="exam-page">
      {/* ── Header bar with timer ── */}
      <div className="exam-header-bar">
        <button className="exam-back-btn" onClick={onBack}>
          ← Quay lại
        </button>
        <h2 className="exam-title-bar">{examName}</h2>
        <div className={`exam-timer ${isTimeLow ? 'timer-warning' : ''}`}>
          <span className="timer-icon">⏱</span>
          <span className="timer-value">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="exam-content">
        {/* ── Left: Question area ── */}
        <div className="exam-question-area">
          {!submitted ? (
            <>
              {/* Question header */}
              <div className="question-header">
                <span className="question-number">Câu {currentIndex + 1}/{questionsData.length}</span>
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
            /* ── Result screen ── */
            <div className="exam-result">
              <div className="result-icon">🎉</div>
              <h2>Hoàn thành bài thi!</h2>
              {scoreResult ? (
                <>
                  <div className="result-score">
                    <span className="score-number">{scoreResult.score}</span>
                    <span className="score-divider">/</span>
                    <span className="score-total">{scoreResult.total}</span>
                  </div>
                  <p className="result-percentage">
                    Đạt {Math.round((scoreResult.score / scoreResult.total) * 100)}%
                  </p>
                </>
              ) : (
                <p className="result-fallback">Bài thi đã được nộp thành công!</p>
              )}
              <button className="btn-primary result-back-btn" onClick={onBack}>
                Quay về danh sách đề thi
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Question navigator panel ── */}
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
            {!submitted && (
              <button
                className="btn-submit-exam"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? '⏳ Đang nộp...' : '📝 Nộp bài'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
